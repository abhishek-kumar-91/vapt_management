import "server-only"

import { randomUUID } from "node:crypto"

import { and, eq, sql } from "drizzle-orm"

import { findings, memberships, organizations, products, users } from "@/db/schema"
import type { OrgSettings } from "@/db/schema"
import { audit } from "@/lib/auth/audit"
import { roleHas } from "@/lib/auth/roles"
import type { Session } from "@/lib/auth/session"
import { EMAIL_PATTERN } from "@/lib/auth/shared"
import { appUrl, sendEmail } from "@/lib/email/send"
import {
  COMPANY_SIZES,
  INDUSTRIES,
  PREFIX_PATTERN,
  prefixFor,
  RESERVED_SLUGS,
  SLUG_PATTERN,
} from "@/lib/orgs"
import { slugify } from "@/lib/sop"

import { auditAs, withOrg, withScope, type Ctx } from "./context"
import { refreshOrgStats } from "./stats"

/** Company profile, review submission and settings. */

export type FormResult =
  | {
      ok: false
      error?: string
      fieldErrors?: Record<string, string>
      values?: Record<string, string>
    }
  | { ok: true; slug?: string }

const UNAVAILABLE = "That didn’t save. Check your connection and try again."
const NOT_ALLOWED = "You don’t have permission to do that."

const text = (form: FormData, name: string, max = 200) =>
  String(form.get(name) ?? "")
    .trim()
    .slice(0, max)

function parseProfile(form: FormData) {
  const values = {
    name: text(form, "name", 80),
    slug: text(form, "slug", 40).toLowerCase(),
    industry: text(form, "industry"),
    size: text(form, "size"),
    website: text(form, "website", 200),
  }
  const fieldErrors: Record<string, string> = {}
  if (values.name.length < 2) fieldErrors.name = "Enter your company’s name."
  if (!(INDUSTRIES as readonly string[]).includes(values.industry))
    fieldErrors.industry = "Choose the closest industry."
  if (!(COMPANY_SIZES as readonly string[]).includes(values.size))
    fieldErrors.size = "Choose your company’s size."
  if (values.website) {
    const url = /^https?:\/\//.test(values.website)
      ? values.website
      : `https://${values.website}`
    try {
      values.website = new URL(url).toString()
    } catch {
      fieldErrors.website = "Enter a web address, like company.com."
    }
  }
  return { values, fieldErrors }
}

const isUnique = (error: unknown) =>
  (error as { code?: string })?.code === "23505" ||
  (error as { cause?: { code?: string } })?.cause?.code === "23505"

/** Onboarding step 1: create the company (draft) with the signed-in person as its Owner. */
export async function createCompany(
  session: Session,
  form: FormData
): Promise<FormResult> {
  const { values, fieldErrors } = parseProfile(form)
  const slug = values.slug || slugify(values.name)
  if (!slug && !values.name) {
    /* the name error already says what to do */
  } else if (!SLUG_PATTERN.test(slug))
    fieldErrors.slug = "Use lower-case letters, numbers and dashes, like acme-corp."
  else if (RESERVED_SLUGS.has(slug))
    fieldErrors.slug = "That address is reserved. Choose another."
  if (Object.keys(fieldErrors).length)
    return { ok: false, fieldErrors, values: { ...values, slug } }

  const orgId = randomUUID()
  try {
    await withScope(
      { orgId, userId: session.user.id, platform: session.user.platform },
      async (tx) => {
        await tx.insert(organizations).values({
          id: orgId,
          name: values.name,
          slug,
          industry: values.industry,
          size: values.size,
          website: values.website || null,
          findingPrefix: prefixFor(slug),
          createdBy: session.user.id,
        })
        await tx.insert(memberships).values({
          orgId,
          userId: session.user.id,
          role: "OWNER",
          status: "active",
          joinedAt: new Date(),
        })
        await refreshOrgStats(tx, orgId)
        await audit(
          {
            action: "org.created",
            outcome: "success",
            actorId: session.user.id,
            actorRole: "OWNER",
            orgId,
            entityType: "organization",
            entityId: orgId,
            changes: { name: [null, values.name], slug: [null, slug] },
          },
          tx
        )
      }
    )
    return { ok: true, slug }
  } catch (error) {
    if (isUnique(error))
      return {
        ok: false,
        fieldErrors: { slug: "That address is taken. Choose another." },
        values: { ...values, slug },
      }
    console.error("create company failed", error)
    return { ok: false, error: UNAVAILABLE, values: { ...values, slug } }
  }
}

/** Edit the company profile. The address (slug) is fixed once created. */
export async function updateCompany(
  ctx: Ctx,
  form: FormData
): Promise<FormResult> {
  if (!roleHas(ctx.role, "org.manage")) return { ok: false, error: NOT_ALLOWED }
  const { values, fieldErrors } = parseProfile(form)
  delete fieldErrors.slug
  if (Object.keys(fieldErrors).length) return { ok: false, fieldErrors, values }
  try {
    await withOrg(ctx, async (tx) => {
      const [before] = await tx
        .select({
          name: organizations.name,
          industry: organizations.industry,
          size: organizations.size,
          website: organizations.website,
        })
        .from(organizations)
        .where(eq(organizations.id, ctx.org.id))
        .for("update")
      const next = {
        name: values.name,
        industry: values.industry,
        size: values.size,
        website: values.website || null,
      }
      const changes = Object.fromEntries(
        (Object.keys(next) as (keyof typeof next)[])
          .filter((k) => before[k] !== next[k])
          .map((k) => [k, [before[k], next[k]]])
      ) as Record<string, [unknown, unknown]>
      if (!Object.keys(changes).length) return
      await tx.update(organizations).set(next).where(eq(organizations.id, ctx.org.id))
      await auditAs(
        ctx,
        { action: "org.updated", outcome: "success", entityType: "organization", entityId: ctx.org.id, changes },
        tx
      )
    })
    return { ok: true }
  } catch (error) {
    console.error("update company failed", error)
    return { ok: false, error: UNAVAILABLE, values }
  }
}

/** Onboarding final step: hand the company to Pentest Scout for review. */
export async function submitForReview(ctx: Ctx): Promise<FormResult> {
  if (ctx.role !== "OWNER") return { ok: false, error: NOT_ALLOWED }
  try {
    return await withOrg(ctx, async (tx): Promise<FormResult> => {
      const [org] = await tx
        .select({ status: organizations.status, name: organizations.name })
        .from(organizations)
        .where(eq(organizations.id, ctx.org.id))
        .for("update")
      if (!org || !["draft", "rejected"].includes(org.status))
        return { ok: false, error: "This company is already waiting for review." }
      const [me] = await tx
        .select({ verified: users.emailVerifiedAt })
        .from(users)
        .where(eq(users.id, ctx.user.id))
      if (!me?.verified)
        return { ok: false, error: "Confirm your email first. Check your inbox for the link." }
      const [count] = await tx
        .select({ n: sql<number>`count(*)::int` })
        .from(products)
        .where(and(eq(products.orgId, ctx.org.id), sql`${products.archivedAt} is null`))
      if (!count.n)
        return { ok: false, error: "Add at least one product to track before submitting." }

      await tx
        .update(organizations)
        .set({ status: "pending_review", submittedAt: new Date() })
        .where(eq(organizations.id, ctx.org.id))
      await auditAs(
        ctx,
        {
          action: "org.submitted",
          outcome: "success",
          entityType: "organization",
          entityId: ctx.org.id,
          changes: { status: [org.status, "pending_review"] },
        },
        tx
      )
      const admins = await tx
        .select({ id: users.id, email: users.email })
        .from(users)
        .where(and(eq(users.platformRole, "SUPER_ADMIN"), eq(users.status, "active")))
      const link = await appUrl(`/admin/companies/${ctx.org.slug}`)
      for (const admin of admins)
        await sendEmail(tx, {
          to: admin.email,
          template: "org_submitted",
          data: { orgName: org.name, ownerName: ctx.user.name, link },
          orgId: ctx.org.id,
          userId: admin.id,
          link,
        })
      return { ok: true }
    })
  } catch (error) {
    console.error("submit for review failed", error)
    return { ok: false, error: UNAVAILABLE }
  }
}

/** Settings → Organization: retest email, Jira base URL, and the finding prefix until the first finding. */
export async function saveOrgSettings(
  ctx: Ctx,
  form: FormData
): Promise<FormResult> {
  if (!roleHas(ctx.role, "org.manage")) return { ok: false, error: NOT_ALLOWED }
  const values = {
    name: text(form, "name", 80),
    retestEmail: text(form, "retestEmail", 254).toLowerCase(),
    jiraBaseUrl: text(form, "jiraBaseUrl", 200),
    findingPrefix: text(form, "findingPrefix", 10).toUpperCase(),
  }
  const fieldErrors: Record<string, string> = {}
  if (values.name.length < 2) fieldErrors.name = "Enter your company’s name."
  if (values.retestEmail && !EMAIL_PATTERN.test(values.retestEmail))
    fieldErrors.retestEmail = "Enter a valid email, like security@company.com."
  if (values.jiraBaseUrl && !/^https:\/\/[^\s]+$/.test(values.jiraBaseUrl))
    fieldErrors.jiraBaseUrl = "Use an https:// address, like https://company.atlassian.net/browse/."
  if (!PREFIX_PATTERN.test(values.findingPrefix))
    fieldErrors.findingPrefix = "2–10 capital letters or numbers, starting with a letter."
  if (Object.keys(fieldErrors).length) return { ok: false, fieldErrors, values }
  try {
    return await withOrg(ctx, async (tx): Promise<FormResult> => {
      const [before] = await tx
        .select({ settings: organizations.settings, prefix: organizations.findingPrefix, name: organizations.name })
        .from(organizations)
        .where(eq(organizations.id, ctx.org.id))
        .for("update")
      if (values.findingPrefix !== before.prefix) {
        const [any] = await tx
          .select({ id: findings.id })
          .from(findings)
          .where(eq(findings.orgId, ctx.org.id))
          .limit(1)
        if (any)
          return {
            ok: false,
            fieldErrors: { findingPrefix: "The prefix can’t change once findings exist." },
            values,
          }
      }
      const settings: OrgSettings = {
        retestEmail: values.retestEmail || undefined,
        jiraBaseUrl: values.jiraBaseUrl || undefined,
      }
      await tx
        .update(organizations)
        .set({ settings, findingPrefix: values.findingPrefix, name: values.name })
        .where(eq(organizations.id, ctx.org.id))
      await auditAs(
        ctx,
        {
          action: "org.settings_changed",
          outcome: "success",
          entityType: "organization",
          entityId: ctx.org.id,
          changes: {
            settings: [before.settings, settings],
            ...(values.name !== before.name ? { name: [before.name, values.name] } : {}),
            ...(values.findingPrefix !== before.prefix
              ? { findingPrefix: [before.prefix, values.findingPrefix] }
              : {}),
          },
        },
        tx
      )
      return { ok: true }
    })
  } catch (error) {
    console.error("save org settings failed", error)
    return { ok: false, error: UNAVAILABLE, values }
  }
}
