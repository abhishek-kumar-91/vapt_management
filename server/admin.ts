import "server-only"

import {
  and,
  asc,
  desc,
  eq,
  ilike,
  inArray,
  isNotNull,
  isNull,
  lt,
  ne,
  notExists,
  or,
  sql,
} from "drizzle-orm"
import { notFound } from "next/navigation"
import { cache } from "react"

import {
  auditLogs,
  emailOutbox,
  memberships,
  organizations,
  orgStats,
  products,
  testingRequests,
  users,
} from "@/db/schema"
import { audit, type Tx } from "@/lib/auth/audit"
import {
  getSession,
  revokeUserSessions,
  type Session,
} from "@/lib/auth/session"
import { issueToken } from "@/lib/auth/tokens"
import { appUrl, sendEmail } from "@/lib/email/send"

import { withScope } from "./context"

/**
 * The Super Admin area. Every function here re-checks the platform role; nothing in /admin is
 * reachable by a company account. Lists read org_stats and paginate, never scanning domain tables
 * across companies.
 */

export type AdminResult =
  { ok: true; link?: string } | { ok: false; error: string }

const PAGE = 50
const UNAVAILABLE = "That didn’t save. Check your connection and try again."

/** The signed-in Super Admin, or a 404 for everyone else. */
export const requirePlatform = cache(async (): Promise<Session> => {
  const session = await getSession()
  if (!session?.user.platform) notFound()
  return session
})

const asPlatform = <T>(session: Session, fn: (tx: Tx) => Promise<T>): Promise<T> =>
  withScope({ userId: session.user.id, platform: true }, fn)

/** Reads for the admin area: Super Admin check, then one platform-scoped transaction. */
export async function adminRead<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  const session = await requirePlatform()
  return asPlatform(session, fn)
}

function adminAudit(
  session: Session,
  entry: Omit<
    Parameters<typeof audit>[0],
    "actorId" | "actorRole" | "actorPlatform"
  >,
  tx: Parameters<typeof audit>[1]
) {
  return audit(
    {
      ...entry,
      actorId: session.user.id,
      actorRole: "SUPER_ADMIN",
      actorPlatform: true,
    },
    tx
  )
}

/* ------------------------------------------------------------------ overview */

export async function overview() {
  return adminRead(async (tx) => {
    const [statusRows, [totals], [requests], [outbox], [funnel], hotspots] =
      await Promise.all([
        tx
          .select({
            status: organizations.status,
            n: sql<number>`count(*)::int`,
          })
          .from(organizations)
          .groupBy(organizations.status),
        tx
          .select({
            critical: sql<number>`coalesce(sum(${orgStats.openCritical}), 0)::int`,
            high: sql<number>`coalesce(sum(${orgStats.openHigh}), 0)::int`,
            open: sql<number>`coalesce(sum(${orgStats.openTotal}), 0)::int`,
            overdue: sql<number>`coalesce(sum(${orgStats.overdue}), 0)::int`,
            products: sql<number>`coalesce(sum(${orgStats.products}), 0)::int`,
            members: sql<number>`coalesce(sum(${orgStats.members}), 0)::int`,
          })
          .from(orgStats),
        tx
          .select({ n: sql<number>`count(*)::int` })
          .from(testingRequests)
          .where(eq(testingRequests.status, "submitted")),
        tx
          .select({ n: sql<number>`count(*)::int` })
          .from(emailOutbox)
          .where(
            and(eq(emailOutbox.status, "pending"), isNotNull(emailOutbox.link))
          ),
        tx
          .select({
            signedUp7d: sql<number>`count(*) filter (where ${users.createdAt} > now() - interval '7 days')::int`,
            unverified: sql<number>`count(*) filter (where ${users.emailVerifiedAt} is null and ${users.status} = 'active')::int`,
          })
          .from(users)
          .where(isNull(users.platformRole)),
        tx
          .select({
            slug: organizations.slug,
            name: organizations.name,
            overdue: orgStats.overdue,
            openCritical: orgStats.openCritical,
            openHigh: orgStats.openHigh,
          })
          .from(orgStats)
          .innerJoin(organizations, eq(organizations.id, orgStats.orgId))
          .where(
            and(
              eq(organizations.status, "active"),
              sql`${orgStats.overdue} + ${orgStats.openCritical} > 0`
            )
          )
          .orderBy(desc(orgStats.openCritical), desc(orgStats.overdue))
          .limit(8),
      ])
    const byStatus = Object.fromEntries(
      statusRows.map((r) => [r.status, r.n])
    ) as Record<string, number>
    return {
      byStatus,
      totals,
      requests: requests.n,
      outbox: outbox.n,
      funnel,
      hotspots,
    }
  })
}

/* ----------------------------------------------------------------- companies */

export interface CompanyRow {
  id: string
  slug: string
  name: string
  status: string
  industry: string | null
  createdAt: Date
  submittedAt: Date | null
  owner: string | null
  ownerEmail: string | null
  products: number
  members: number
  openCritical: number
  openHigh: number
  overdue: number
  lastActivityAt: Date | null
}

const ownerName = sql<string | null>`(
  select u.name from memberships m join users u on u.id = m.user_id
  where m.org_id = "organizations"."id" and m.role = 'OWNER' and m.status = 'active'
  order by m.joined_at limit 1)`
const ownerEmail = sql<string | null>`(
  select u.email from memberships m join users u on u.id = m.user_id
  where m.org_id = "organizations"."id" and m.role = 'OWNER' and m.status = 'active'
  order by m.joined_at limit 1)`

/** Companies, newest first, keyset-paginated by (created_at, id). */
export async function listCompanies(opts: {
  q?: string
  status?: string
  before?: string
}): Promise<{ rows: CompanyRow[]; next: string | null }> {
  return adminRead(async (tx) => {
    const [beforeAt, beforeId] = opts.before?.split("_") ?? []
    const q = opts.q?.trim()
    const rows = await tx
      .select({
        id: organizations.id,
        slug: organizations.slug,
        name: organizations.name,
        status: organizations.status,
        industry: organizations.industry,
        createdAt: organizations.createdAt,
        submittedAt: organizations.submittedAt,
        owner: ownerName,
        ownerEmail,
        products: sql<number>`coalesce(${orgStats.products}, 0)`,
        members: sql<number>`coalesce(${orgStats.members}, 0)`,
        openCritical: sql<number>`coalesce(${orgStats.openCritical}, 0)`,
        openHigh: sql<number>`coalesce(${orgStats.openHigh}, 0)`,
        overdue: sql<number>`coalesce(${orgStats.overdue}, 0)`,
        lastActivityAt: orgStats.lastActivityAt,
      })
      .from(organizations)
      .leftJoin(orgStats, eq(orgStats.orgId, organizations.id))
      .where(
        and(
          opts.status
            ? eq(organizations.status, opts.status as "active")
            : undefined,
          q
            ? or(
                ilike(organizations.name, `%${q}%`),
                ilike(organizations.slug, `%${q}%`)
              )
            : undefined,
          beforeAt && beforeId
            ? sql`(${organizations.createdAt}, ${organizations.id}) < (${new Date(Number(beforeAt))}, ${beforeId})`
            : undefined
        )
      )
      .orderBy(desc(organizations.createdAt), desc(organizations.id))
      .limit(PAGE + 1)
    const more = rows.length > PAGE
    const page = rows.slice(0, PAGE)
    const last = page.at(-1)
    return {
      rows: page,
      next: more && last ? `${last.createdAt.getTime()}_${last.id}` : null,
    }
  })
}

/** Companies waiting for review, oldest first. */
export async function listPending() {
  return adminRead(async (tx) => {
    return tx
      .select({
        slug: organizations.slug,
        name: organizations.name,
        industry: organizations.industry,
        size: organizations.size,
        submittedAt: organizations.submittedAt,
        owner: ownerName,
        ownerEmail,
        products: sql<number>`coalesce(${orgStats.products}, 0)`,
      })
      .from(organizations)
      .leftJoin(orgStats, eq(orgStats.orgId, organizations.id))
      .where(eq(organizations.status, "pending_review"))
      .orderBy(asc(organizations.submittedAt))
  })
}

export async function getCompany(slug: string) {
  return adminRead(async (tx) => {
    const [org] = await tx
      .select()
      .from(organizations)
      .leftJoin(orgStats, eq(orgStats.orgId, organizations.id))
      .where(eq(organizations.slug, slug))
    if (!org) return null
    const id = org.organizations.id
    const [members, productList, history] = await Promise.all([
      tx
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          role: memberships.role,
          status: memberships.status,
          verified: users.emailVerifiedAt,
          lastLoginAt: users.lastLoginAt,
        })
        .from(memberships)
        .innerJoin(users, eq(users.id, memberships.userId))
        .where(
          and(eq(memberships.orgId, id), ne(memberships.status, "removed"))
        )
        .orderBy(asc(memberships.role), asc(users.name)),
      tx
        .select({
          slug: products.slug,
          name: products.name,
          tier: products.tier,
          status: products.status,
          domain: products.domain,
          technology: products.technology,
          dataSensitivity: products.dataSensitivity,
          archivedAt: products.archivedAt,
        })
        .from(products)
        .where(eq(products.orgId, id))
        .orderBy(asc(products.name)),
      tx
        .select({
          at: auditLogs.occurredAt,
          action: auditLogs.action,
          actorPlatform: auditLogs.actorPlatform,
          actor: users.name,
          changes: auditLogs.changes,
        })
        .from(auditLogs)
        .leftJoin(users, eq(users.id, auditLogs.actorId))
        .where(
          and(eq(auditLogs.orgId, id), sql`${auditLogs.action} like 'org.%'`)
        )
        .orderBy(desc(auditLogs.occurredAt))
        .limit(20),
    ])
    return {
      org: org.organizations,
      stats: org.org_stats,
      members,
      products: productList,
      history,
    }
  })
}

/** Approve, reject (reason required) or send back for changes (note required). */
export async function reviewCompany(
  slug: string,
  decision: "approve" | "reject" | "changes",
  note: string
): Promise<AdminResult> {
  const session = await requirePlatform()
  const trimmed = note.trim().slice(0, 2000)
  if (decision !== "approve" && !trimmed)
    return {
      ok: false,
      error:
        decision === "reject"
          ? "Give the reason it isn’t approved."
          : "Say what needs to change.",
    }
  try {
    return await asPlatform(session, async (tx): Promise<AdminResult> => {
      const [org] = await tx
        .select({
          id: organizations.id,
          name: organizations.name,
          status: organizations.status,
        })
        .from(organizations)
        .where(eq(organizations.slug, slug))
        .for("update")
      if (!org) return { ok: false, error: "Company not found." }
      if (org.status !== "pending_review")
        return {
          ok: false,
          error: "Only companies waiting for review can be decided.",
        }
      const status =
        decision === "approve"
          ? "active"
          : decision === "reject"
            ? "rejected"
            : "draft"
      await tx
        .update(organizations)
        .set({
          status,
          reviewedAt: new Date(),
          reviewedBy: session.user.id,
          reviewNote: decision === "approve" ? null : trimmed,
        })
        .where(eq(organizations.id, org.id))
      await adminAudit(
        session,
        {
          action:
            decision === "approve"
              ? "org.approved"
              : decision === "reject"
                ? "org.rejected"
                : "org.changes_requested",
          outcome: "success",
          orgId: org.id,
          entityType: "organization",
          entityId: org.id,
          changes: { status: [org.status, status] },
          meta: trimmed ? { note: trimmed } : undefined,
        },
        tx
      )
      const owners = await tx
        .select({ id: users.id, email: users.email })
        .from(memberships)
        .innerJoin(users, eq(users.id, memberships.userId))
        .where(
          and(
            eq(memberships.orgId, org.id),
            eq(memberships.role, "OWNER"),
            eq(memberships.status, "active")
          )
        )
      const link = await appUrl(
        decision === "approve" ? `/o/${slug}` : "/onboarding"
      )
      for (const owner of owners)
        await sendEmail(tx, {
          to: owner.email,
          userId: owner.id,
          orgId: org.id,
          link,
          ...(decision === "approve"
            ? {
                template: "org_approved" as const,
                data: { orgName: org.name, link },
              }
            : decision === "reject"
              ? {
                  template: "org_rejected" as const,
                  data: { orgName: org.name, note: trimmed, link },
                }
              : {
                  template: "org_changes_requested" as const,
                  data: { orgName: org.name, note: trimmed, link },
                }),
        })
      return { ok: true }
    })
  } catch (error) {
    console.error("review company failed", error)
    return { ok: false, error: UNAVAILABLE }
  }
}

/** Suspend, reactivate or close a live company. Data is always kept. */
export async function setCompanyStatus(
  slug: string,
  next: "active" | "suspended" | "closed",
  note = ""
): Promise<AdminResult> {
  const session = await requirePlatform()
  try {
    return await asPlatform(session, async (tx): Promise<AdminResult> => {
      const [org] = await tx
        .select({ id: organizations.id, status: organizations.status })
        .from(organizations)
        .where(eq(organizations.slug, slug))
        .for("update")
      if (!org) return { ok: false, error: "Company not found." }
      const allowed =
        (next === "suspended" && org.status === "active") ||
        (next === "active" && org.status === "suspended") ||
        (next === "closed" && org.status !== "closed")
      if (!allowed)
        return {
          ok: false,
          error:
            "That change isn’t possible from the company’s current status.",
        }
      await tx
        .update(organizations)
        .set({ status: next })
        .where(eq(organizations.id, org.id))
      await adminAudit(
        session,
        {
          action:
            next === "active"
              ? "org.reactivated"
              : next === "suspended"
                ? "org.suspended"
                : "org.closed",
          outcome: "success",
          orgId: org.id,
          entityType: "organization",
          entityId: org.id,
          changes: { status: [org.status, next] },
          meta: note.trim() ? { note: note.trim().slice(0, 2000) } : undefined,
        },
        tx
      )
      return { ok: true }
    })
  } catch (error) {
    console.error("set company status failed", error)
    return { ok: false, error: UNAVAILABLE }
  }
}

/* ------------------------------------------------------------------- sign-ups */

const STALE_DAYS = 7

/** The sign-up funnel, derived from users, memberships and organizations (no extra table). */
export async function signupFunnel() {
  return adminRead(async (tx) => {
    const noMembership = notExists(
      tx
        .select({ one: sql`1` })
        .from(memberships)
        .where(eq(memberships.userId, users.id))
    )
    const person = {
      id: users.id,
      name: users.name,
      email: users.email,
      createdAt: users.createdAt,
      stale: sql<boolean>`${users.createdAt} < now() - make_interval(days => ${STALE_DAYS})`,
    }
    const [unverified, noCompany, drafts, failures] = await Promise.all([
      tx
        .select(person)
        .from(users)
        .where(
          and(
            isNull(users.platformRole),
            eq(users.status, "active"),
            isNull(users.emailVerifiedAt),
            noMembership
          )
        )
        .orderBy(desc(users.createdAt))
        .limit(PAGE),
      tx
        .select(person)
        .from(users)
        .where(
          and(
            isNull(users.platformRole),
            eq(users.status, "active"),
            isNotNull(users.emailVerifiedAt),
            noMembership
          )
        )
        .orderBy(desc(users.createdAt))
        .limit(PAGE),
      tx
        .select({
          slug: organizations.slug,
          name: organizations.name,
          status: organizations.status,
          createdAt: organizations.createdAt,
          reviewNote: organizations.reviewNote,
          owner: ownerName,
          ownerEmail,
          stale: sql<boolean>`${organizations.updatedAt} < now() - make_interval(days => ${STALE_DAYS})`,
        })
        .from(organizations)
        .where(inArray(organizations.status, ["draft", "rejected"]))
        .orderBy(desc(organizations.createdAt))
        .limit(PAGE),
      tx
        .select({
          at: auditLogs.occurredAt,
          action: auditLogs.action,
          outcome: auditLogs.outcome,
          meta: auditLogs.meta,
          email: users.email,
        })
        .from(auditLogs)
        .leftJoin(users, eq(users.id, auditLogs.actorId))
        .where(
          and(
            or(
              sql`${auditLogs.action} like 'signup.%'`,
              sql`${auditLogs.action} like 'email.%'`
            ),
            ne(auditLogs.outcome, "success")
          )
        )
        .orderBy(desc(auditLogs.occurredAt))
        .limit(PAGE),
    ])
    return { unverified, noCompany, drafts, failures }
  })
}

/** Send someone a fresh verification link (for sign-ups stuck before confirming). */
export async function resendVerificationFor(
  userId: string
): Promise<AdminResult> {
  const session = await requirePlatform()
  try {
    return await asPlatform(session, async (tx): Promise<AdminResult> => {
      const [user] = await tx
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          verified: users.emailVerifiedAt,
        })
        .from(users)
        .where(eq(users.id, userId))
      if (!user || user.verified)
        return {
          ok: false,
          error: "This person has already confirmed their email.",
        }
      const issued = await issueToken(tx, {
        userId,
        purpose: "email_verify",
        createdBy: session.user.id,
      })
      const link = await appUrl(`/verify/${issued.token}`)
      await sendEmail(tx, {
        to: user.email,
        template: "verify_email",
        data: { name: user.name, link },
        userId,
        link,
        tokenId: issued.tokenId,
        expiresAt: issued.expiresAt,
      })
      await adminAudit(
        session,
        {
          action: "email.verify_resent",
          outcome: "success",
          entityType: "user",
          entityId: userId,
        },
        tx
      )
      return { ok: true, link }
    })
  } catch (error) {
    console.error("admin resend verification failed", error)
    return { ok: false, error: UNAVAILABLE }
  }
}

/* --------------------------------------------------------------------- outbox */

export async function listOutbox(status: "pending" | "all") {
  return adminRead(async (tx) => {
    return tx
      .select({
        id: emailOutbox.id,
        to: emailOutbox.toEmail,
        template: emailOutbox.template,
        subject: emailOutbox.subject,
        link: emailOutbox.link,
        status: emailOutbox.status,
        createdAt: emailOutbox.createdAt,
        expiresAt: emailOutbox.expiresAt,
        org: organizations.name,
      })
      .from(emailOutbox)
      .leftJoin(organizations, eq(organizations.id, emailOutbox.orgId))
      .where(
        status === "pending" ? eq(emailOutbox.status, "pending") : undefined
      )
      .orderBy(desc(emailOutbox.createdAt))
      .limit(100)
  })
}

/** Mark a queued email as sent by hand (after copying its link), so the queue stays honest. */
export async function markOutboxSent(id: string): Promise<AdminResult> {
  const session = await requirePlatform()
  await asPlatform(session, async (tx) => {
    await tx
      .update(emailOutbox)
      .set({ status: "sent", sentAt: new Date() })
      .where(and(eq(emailOutbox.id, id), eq(emailOutbox.status, "pending")))
    await adminAudit(
      session,
      {
        action: "email.sent_manually",
        outcome: "success",
        entityType: "email",
        entityId: id,
      },
      tx
    )
  })
  return { ok: true }
}

/* ---------------------------------------------------------------------- users */

export async function searchUsers(q: string) {
  return adminRead(async (tx) => {
    const term = q.trim()
    const people = await tx
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        status: users.status,
        platformRole: users.platformRole,
        verified: users.emailVerifiedAt,
        lastLoginAt: users.lastLoginAt,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(
        term
          ? or(ilike(users.email, `%${term}%`), ilike(users.name, `%${term}%`))
          : undefined
      )
      .orderBy(desc(users.createdAt))
      .limit(PAGE)
    const companies = people.length
      ? await tx
          .select({
            userId: memberships.userId,
            slug: organizations.slug,
            name: organizations.name,
            role: memberships.role,
            status: memberships.status,
          })
          .from(memberships)
          .innerJoin(organizations, eq(organizations.id, memberships.orgId))
          .where(
            and(
              inArray(
                memberships.userId,
                people.map((p) => p.id)
              ),
              ne(memberships.status, "removed")
            )
          )
      : []
    return people.map((p) => ({
      ...p,
      companies: companies.filter((c) => c.userId === p.id),
    }))
  })
}

/** Block or unblock an account everywhere. Super Admin accounts can't be disabled here. */
export async function setUserDisabled(
  userId: string,
  disabled: boolean
): Promise<AdminResult> {
  const session = await requirePlatform()
  if (userId === session.user.id)
    return { ok: false, error: "You can’t disable your own account." }
  try {
    return await asPlatform(session, async (tx): Promise<AdminResult> => {
      const [user] = await tx
        .select({
          status: users.status,
          platformRole: users.platformRole,
          hasPassword: sql<boolean>`${users.passwordHash} is not null`,
        })
        .from(users)
        .where(eq(users.id, userId))
        .for("update")
      if (!user || user.platformRole)
        return { ok: false, error: "This account can’t be changed here." }
      const next = disabled
        ? "disabled"
        : user.hasPassword
          ? "active"
          : "invited"
      await tx.update(users).set({ status: next }).where(eq(users.id, userId))
      if (disabled) await revokeUserSessions(tx, userId)
      await adminAudit(
        session,
        {
          action: disabled ? "user.disabled" : "user.enabled",
          outcome: "success",
          entityType: "user",
          entityId: userId,
          changes: { status: [user.status, next] },
        },
        tx
      )
      return { ok: true }
    })
  } catch (error) {
    console.error("set user disabled failed", error)
    return { ok: false, error: UNAVAILABLE }
  }
}

/** A password reset link for any active account (support). */
export async function adminResetLink(userId: string): Promise<AdminResult> {
  const session = await requirePlatform()
  try {
    return await asPlatform(session, async (tx): Promise<AdminResult> => {
      const [user] = await tx
        .select({ name: users.name, email: users.email, status: users.status })
        .from(users)
        .where(eq(users.id, userId))
      if (!user || user.status !== "active")
        return {
          ok: false,
          error: "Only active accounts can reset a password.",
        }
      const issued = await issueToken(tx, {
        userId,
        purpose: "password_reset",
        createdBy: session.user.id,
      })
      const link = await appUrl(`/set-password/${issued.token}`)
      await sendEmail(tx, {
        to: user.email,
        template: "password_reset",
        data: { name: user.name, link },
        userId,
        link,
        tokenId: issued.tokenId,
        expiresAt: issued.expiresAt,
      })
      await adminAudit(
        session,
        {
          action: "user.reset_link_created",
          outcome: "success",
          entityType: "user",
          entityId: userId,
        },
        tx
      )
      return { ok: true, link }
    })
  } catch (error) {
    console.error("admin reset link failed", error)
    return { ok: false, error: UNAVAILABLE }
  }
}

/* ------------------------------------------------------------------- products */

export async function listAllProducts(q: string) {
  return adminRead(async (tx) => {
    const term = q.trim()
    return tx
      .select({
        slug: products.slug,
        name: products.name,
        tier: products.tier,
        status: products.status,
        domain: products.domain,
        archivedAt: products.archivedAt,
        orgSlug: organizations.slug,
        orgName: organizations.name,
        openFindings: sql<number>`(select count(*)::int from findings f where f.product_id = "products"."id" and f.status in ('Open','Triaged','In Fix','Ready for Retest'))`,
      })
      .from(products)
      .innerJoin(organizations, eq(organizations.id, products.orgId))
      .where(
        term
          ? or(
              ilike(products.name, `%${term}%`),
              ilike(organizations.name, `%${term}%`),
              ilike(products.domain, `%${term}%`)
            )
          : undefined
      )
      .orderBy(asc(organizations.name), asc(products.name))
      .limit(100)
  })
}

/* ---------------------------------------------------------------------- audit */

export async function listAudit(opts: {
  org?: string
  action?: string
  before?: number
}) {
  return adminRead(async (tx) => {
    let orgId: string | undefined
    if (opts.org) {
      const [o] = await tx
        .select({ id: organizations.id })
        .from(organizations)
        .where(eq(organizations.slug, opts.org))
      orgId = o?.id ?? "00000000-0000-0000-0000-000000000000"
    }
    const rows = await tx
      .select({
        id: auditLogs.id,
        at: auditLogs.occurredAt,
        action: auditLogs.action,
        outcome: auditLogs.outcome,
        actor: users.name,
        actorEmail: users.email,
        actorRole: auditLogs.actorRole,
        actorPlatform: auditLogs.actorPlatform,
        org: organizations.name,
        orgSlug: organizations.slug,
        entityType: auditLogs.entityType,
        entityId: auditLogs.entityId,
        changes: auditLogs.changes,
        ip: auditLogs.ip,
      })
      .from(auditLogs)
      .leftJoin(users, eq(users.id, auditLogs.actorId))
      .leftJoin(organizations, eq(organizations.id, auditLogs.orgId))
      .where(
        and(
          orgId ? eq(auditLogs.orgId, orgId) : undefined,
          opts.action
            ? sql`${auditLogs.action} like ${`${opts.action.replace(/[%_]/g, "")}%`}`
            : undefined,
          opts.before ? lt(auditLogs.id, opts.before) : undefined
        )
      )
      .orderBy(desc(auditLogs.id))
      .limit(PAGE + 1)
    const more = rows.length > PAGE
    const page = rows.slice(0, PAGE)
    return { rows: page, next: more ? page.at(-1)!.id : null }
  })
}

/* ------------------------------------------------------------------- settings */

export async function listAdmins() {
  return adminRead(async (tx) => {
    return tx
      .select({
        name: users.name,
        email: users.email,
        lastLoginAt: users.lastLoginAt,
      })
      .from(users)
      .where(eq(users.platformRole, "SUPER_ADMIN"))
      .orderBy(asc(users.name))
  })
}
