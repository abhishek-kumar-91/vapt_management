import "server-only"

import { and, asc, eq, inArray, sql } from "drizzle-orm"
import { cache } from "react"

import { db } from "@/db"
import {
  memberships,
  organizations,
  productMembers,
  products,
} from "@/db/schema"
import { audit, type Tx } from "@/lib/auth/audit"
import type { Actor, Role } from "@/lib/auth/roles"
import { getSession, type Session } from "@/lib/auth/session"
import type { OrgSummary, SessionUser } from "@/lib/auth/shared"

/**
 * Who is acting, in which company, with what access. Every server/* function takes one.
 * Built only from the session and the database; nothing here comes from the browser.
 */
export interface Ctx extends Actor {
  sessionId: string
  user: Session["user"]
  org: OrgSummary
  /** SUPER_ADMIN for platform admins (even if also a member), else their company role. */
  role: Role
  /** Slugs of the products in productIds, for the browser (which keys products by slug). */
  productSlugs: Record<string, string>
}

const orgColumns = {
  id: organizations.id,
  slug: organizations.slug,
  name: organizations.name,
  status: organizations.status,
}

async function build(
  session: Session,
  org: OrgSummary,
  memberRole: Role | null
): Promise<Ctx | null> {
  const platform = session.user.platform
  if (!platform && !memberRole) return null
  const access = platform
    ? []
    : await withScope(
        { orgId: org.id, userId: session.user.id, platform },
        (tx) =>
          tx
            .select({
              productId: productMembers.productId,
              access: productMembers.access,
              slug: products.slug,
            })
            .from(productMembers)
            .innerJoin(products, eq(products.id, productMembers.productId))
            .where(
              and(
                eq(productMembers.orgId, org.id),
                eq(productMembers.userId, session.user.id)
              )
            )
      )
  return {
    sessionId: session.id,
    user: session.user,
    org,
    role: platform ? "SUPER_ADMIN" : memberRole!,
    productIds: access.map((a) => a.productId),
    editProductIds: access
      .filter((a) => a.access === "edit")
      .map((a) => a.productId),
    productSlugs: Object.fromEntries(access.map((a) => [a.productId, a.slug])),
  }
}

/**
 * The context for /o/<orgSlug>. Null when signed out, when the company doesn't exist, or when
 * the person isn't an active member (callers answer 404 so a company's existence never leaks).
 * Super Admins get a context for every company.
 */
export const getContext = cache(async (orgSlug: string) => {
  const session = await getSession()
  if (!session) return null
  const [row] = await withScope(
    { userId: session.user.id, platform: session.user.platform },
    (tx) =>
      tx
        .select({ ...orgColumns, memberRole: memberships.role })
        .from(organizations)
        .leftJoin(
          memberships,
          and(
            eq(memberships.orgId, organizations.id),
            eq(memberships.userId, session.user.id),
            eq(memberships.status, "active")
          )
        )
        .where(eq(organizations.slug, orgSlug))
        .limit(1)
  )
  if (!row) return null
  const { memberRole, ...org } = row
  return build(session, org, memberRole)
})

export const LAST_ORG_COOKIE = "last_org"

/** Companies this person can open: active memberships in active companies. */
export const listMyOrgs = cache(async (userId: string) =>
  withScope({ userId, platform: false }, (tx) =>
    tx
      .select({ slug: organizations.slug, name: organizations.name })
      .from(memberships)
      .innerJoin(organizations, eq(organizations.id, memberships.orgId))
      .where(
        and(
          eq(memberships.userId, userId),
          eq(memberships.status, "active"),
          eq(organizations.status, "active")
        )
      )
      .orderBy(asc(organizations.name))
  )
)

/** A company this person owns that is still being set up or reviewed. */
export const findOnboardingOrg = cache(async (userId: string) => {
  const [row] = await withScope({ userId, platform: false }, (tx) =>
    tx
      .select(orgColumns)
      .from(memberships)
      .innerJoin(organizations, eq(organizations.id, memberships.orgId))
      .where(
        and(
          eq(memberships.userId, userId),
          eq(memberships.role, "OWNER"),
          eq(memberships.status, "active"),
          inArray(organizations.status, ["draft", "pending_review", "rejected"])
        )
      )
      .orderBy(asc(organizations.createdAt))
      .limit(1)
  )
  return row ?? null
})

/**
 * Where a signed-in person lands: Super Admins → /admin; members → their last company (or the
 * first one); an Owner still setting up → /onboarding; anyone else → null (nothing to open).
 */
export async function homeFor(
  session: Session,
  lastOrg?: string
): Promise<string | null> {
  if (session.user.platform) return "/admin"
  const orgs = await listMyOrgs(session.user.id)
  const pick = orgs.find((o) => o.slug === lastOrg) ?? orgs[0]
  if (pick) return `/o/${pick.slug}`
  if (await findOnboardingOrg(session.user.id)) return "/onboarding"
  return null
}

/**
 * Run `fn` in one transaction with the row-level security variables set (enforced once the app
 * connects as app_user, phase 9): the company being acted in, the person, and whether they are
 * a Super Admin. Every query inside is limited to that scope even if it forgets its own filter.
 */
export function withScope<T>(
  scope: { orgId?: string | null; userId: string; platform: boolean },
  fn: (tx: Tx) => Promise<T>
) {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select
      set_config('app.org_id', ${scope.orgId ?? ""}, true),
      set_config('app.user_id', ${scope.userId}, true),
      set_config('app.platform', ${scope.platform ? "on" : "off"}, true)`)
    return fn(tx)
  })
}

/**
 * For flows acting on a one-time token or a schedule, before any company or person is chosen
 * (accepting an invite, setting a password from a link, cron jobs). Platform scope inside one
 * short transaction; the caller has already checked the token or the cron secret.
 */
export const withSystem = <T>(fn: (tx: Tx) => Promise<T>) =>
  withScope({ userId: "", platform: true }, fn)

/** withScope for the context's company. */
export const withOrg = <T>(ctx: Ctx, fn: (tx: Tx) => Promise<T>) =>
  withScope(
    { orgId: ctx.org.id, userId: ctx.user.id, platform: ctx.user.platform },
    fn
  )

type AuditFields = Omit<
  Parameters<typeof audit>[0],
  "actorId" | "actorRole" | "actorPlatform" | "orgId"
>

/** Audit row for an action taken in the context's company, attributed to its actor. */
export function auditAs(ctx: Ctx, entry: AuditFields, tx: Tx) {
  return audit(
    {
      ...entry,
      actorId: ctx.user.id,
      actorRole: ctx.role,
      actorPlatform: ctx.user.platform,
      orgId: ctx.org.id,
    },
    tx
  )
}

/** The cut-down user the browser gets. Never includes hashes, tokens or session ids. */
export async function toSessionUser(ctx: Ctx): Promise<SessionUser> {
  return {
    orgs: await listMyOrgs(ctx.user.id),
    id: ctx.user.id,
    name: ctx.user.name,
    email: ctx.user.email,
    role: ctx.role,
    // The browser keys products by slug, so its access lists are slugs too.
    productIds: ctx.productIds.map((id) => ctx.productSlugs[id]),
    editProductIds: ctx.editProductIds.map((id) => ctx.productSlugs[id]),
    org: ctx.org,
  }
}
