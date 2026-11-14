import "server-only"

import { and, desc, eq, sql } from "drizzle-orm"

import {
  activityEvents,
  memberships,
  organizations,
  products,
  testingRequests,
  users,
} from "@/db/schema"
import type { Tx } from "@/lib/auth/audit"
import { audit } from "@/lib/auth/audit"
import { roleHas } from "@/lib/auth/roles"
import type { Session } from "@/lib/auth/session"
import { appUrl, sendEmail } from "@/lib/email/send"
import { todayIso } from "@/lib/dates"

import { adminRead, requirePlatform } from "./admin"
import { auditAs, withOrg, withScope, type Ctx } from "./context"

/**
 * A company asks Pentest Scout to test one of its products; Super Admins answer and run it.
 *   submitted → accepted → scheduled → in_progress → completed
 *   submitted → declined (with a note)
 *   submitted | accepted | scheduled → cancelled (by the Owner)
 */

import { TESTING_LABELS, type TestingStatus } from "@/lib/testing"

export { TESTING_LABELS, type TestingStatus }

type Result =
  | { ok: true; notice?: string }
  | {
      ok: false
      error?: string
      fieldErrors?: Record<string, string>
      values?: Record<string, string>
    }

const UNAVAILABLE = "That didn’t save. Check your connection and try again."
const day = (v: string) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null)
const text = (form: FormData, name: string, max = 2000) =>
  String(form.get(name) ?? "")
    .trim()
    .slice(0, max)

const columns = {
  id: testingRequests.id,
  status: testingRequests.status,
  scope: testingRequests.scope,
  environment: testingRequests.environment,
  notes: testingRequests.notes,
  contact: testingRequests.contact,
  preferredStart: testingRequests.preferredStart,
  preferredEnd: testingRequests.preferredEnd,
  scheduledStart: testingRequests.scheduledStart,
  scheduledEnd: testingRequests.scheduledEnd,
  decisionNote: testingRequests.decisionNote,
  createdAt: testingRequests.createdAt,
  completedAt: testingRequests.completedAt,
  productSlug: products.slug,
  productName: products.name,
  requestedBy: users.name,
  assignee: sql<
    string | null
  >`(select name from users a where a.id = "testing_requests"."assigned_to")`,
  findings: sql<number>`(select count(*)::int from findings f where f.testing_request_id = "testing_requests"."id")`,
}

/* --------------------------------------------------------------- the company */

export async function listCompanyRequests(ctx: Ctx) {
  return withOrg(ctx, (tx) =>
    tx
      .select(columns)
      .from(testingRequests)
      .innerJoin(products, eq(products.id, testingRequests.productId))
      .innerJoin(users, eq(users.id, testingRequests.requestedBy))
      .where(eq(testingRequests.orgId, ctx.org.id))
      .orderBy(desc(testingRequests.createdAt))
  )
}

async function notifyOwners(
  tx: Tx,
  orgId: string,
  build: (orgName: string) => Parameters<typeof sendEmail>[1]
) {
  const [org] = await tx
    .select({ name: organizations.name })
    .from(organizations)
    .where(eq(organizations.id, orgId))
  const owners = await tx
    .select({ id: users.id, email: users.email })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(
      and(
        eq(memberships.orgId, orgId),
        eq(memberships.role, "OWNER"),
        eq(memberships.status, "active")
      )
    )
  for (const o of owners)
    await sendEmail(tx, {
      ...build(org.name),
      to: o.email,
      userId: o.id,
      orgId,
    })
}

export async function createRequest(ctx: Ctx, form: FormData): Promise<Result> {
  if (!roleHas(ctx.role, "testing.request"))
    return { ok: false, error: "Only Owners can request testing." }
  const values = {
    product: text(form, "product", 80),
    scope: text(form, "scope", 4000),
    environment: text(form, "environment", 500),
    contact: text(form, "contact", 300),
    notes: text(form, "notes", 4000),
    preferredStart: text(form, "preferredStart", 10),
    preferredEnd: text(form, "preferredEnd", 10),
  }
  const fieldErrors: Record<string, string> = {}
  if (!values.product) fieldErrors.product = "Choose the product to test."
  if (values.scope.length < 10)
    fieldErrors.scope = "Describe what should be tested, in a sentence or two."
  if (values.preferredStart && !day(values.preferredStart))
    fieldErrors.preferredStart = "Use a date."
  if (values.preferredEnd && !day(values.preferredEnd))
    fieldErrors.preferredEnd = "Use a date."
  if (
    values.preferredStart &&
    values.preferredEnd &&
    values.preferredEnd < values.preferredStart
  )
    fieldErrors.preferredEnd = "End after the start date."
  if (Object.keys(fieldErrors).length) return { ok: false, fieldErrors, values }
  try {
    return await withOrg(ctx, async (tx): Promise<Result> => {
      const [product] = await tx
        .select({ id: products.id, name: products.name })
        .from(products)
        .where(
          and(eq(products.orgId, ctx.org.id), eq(products.slug, values.product))
        )
      if (!product)
        return {
          ok: false,
          fieldErrors: { product: "Choose the product to test." },
          values,
        }
      const [open] = await tx
        .select({ id: testingRequests.id })
        .from(testingRequests)
        .where(
          and(
            eq(testingRequests.productId, product.id),
            sql`${testingRequests.status} in ('submitted','accepted','scheduled','in_progress')`
          )
        )
      if (open)
        return {
          ok: false,
          error: `${product.name} already has an open testing request.`,
          values,
        }
      const [row] = await tx
        .insert(testingRequests)
        .values({
          orgId: ctx.org.id,
          productId: product.id,
          requestedBy: ctx.user.id,
          scope: values.scope,
          environment: values.environment || null,
          contact: values.contact || null,
          notes: values.notes || null,
          preferredStart: day(values.preferredStart),
          preferredEnd: day(values.preferredEnd),
        })
        .returning({ id: testingRequests.id })
      await auditAs(
        ctx,
        {
          action: "testing_request.created",
          outcome: "success",
          entityType: "testing_request",
          entityId: row.id,
          productId: product.id,
        },
        tx
      )
      const admins = await tx
        .select({ id: users.id, email: users.email })
        .from(users)
        .where(
          and(eq(users.platformRole, "SUPER_ADMIN"), eq(users.status, "active"))
        )
      const link = await appUrl(`/admin/testing/${row.id}`)
      for (const a of admins)
        await sendEmail(tx, {
          to: a.email,
          userId: a.id,
          orgId: ctx.org.id,
          template: "testing_request_new",
          data: { orgName: ctx.org.name, productName: product.name, link },
          link,
        })
      return {
        ok: true,
        notice: `Request sent. Pentest Scout will reply about ${product.name}.`,
      }
    })
  } catch (error) {
    console.error("create testing request failed", error)
    return { ok: false, error: UNAVAILABLE, values }
  }
}

export async function cancelRequest(ctx: Ctx, id: string): Promise<Result> {
  if (!roleHas(ctx.role, "testing.request"))
    return { ok: false, error: "Only Owners can cancel a request." }
  try {
    return await withOrg(ctx, async (tx): Promise<Result> => {
      const [r] = await tx
        .select({
          status: testingRequests.status,
          productId: testingRequests.productId,
        })
        .from(testingRequests)
        .where(
          and(eq(testingRequests.id, id), eq(testingRequests.orgId, ctx.org.id))
        )
        .for("update")
      if (!r || !["submitted", "accepted", "scheduled"].includes(r.status))
        return {
          ok: false,
          error: "Only requests that haven’t started can be cancelled.",
        }
      await tx
        .update(testingRequests)
        .set({ status: "cancelled" })
        .where(eq(testingRequests.id, id))
      await auditAs(
        ctx,
        {
          action: "testing_request.cancelled",
          outcome: "success",
          entityType: "testing_request",
          entityId: id,
          productId: r.productId,
          changes: { status: [r.status, "cancelled"] },
        },
        tx
      )
      return { ok: true }
    })
  } catch (error) {
    console.error("cancel testing request failed", error)
    return { ok: false, error: UNAVAILABLE }
  }
}

/* ------------------------------------------------------------- Pentest Scout */

export async function listAllRequests(status?: string) {
  return adminRead(async (tx) => {
    return tx
      .select({
        ...columns,
        orgName: organizations.name,
        orgSlug: organizations.slug,
      })
      .from(testingRequests)
      .innerJoin(products, eq(products.id, testingRequests.productId))
      .innerJoin(users, eq(users.id, testingRequests.requestedBy))
      .innerJoin(organizations, eq(organizations.id, testingRequests.orgId))
      .where(
        status ? eq(testingRequests.status, status as TestingStatus) : undefined
      )
      .orderBy(
        sql`case ${testingRequests.status} when 'submitted' then 0 when 'in_progress' then 1 when 'scheduled' then 2 when 'accepted' then 3 else 4 end`,
        desc(testingRequests.createdAt)
      )
      .limit(200)
  })
}

export async function getRequest(id: string) {
  return adminRead(async (tx) => {
    if (!/^[0-9a-f-]{36}$/.test(id)) return null
    const [row] = await tx
      .select({
        ...columns,
        orgName: organizations.name,
        orgSlug: organizations.slug,
        orgId: organizations.id,
      })
      .from(testingRequests)
      .innerJoin(products, eq(products.id, testingRequests.productId))
      .innerJoin(users, eq(users.id, testingRequests.requestedBy))
      .innerJoin(organizations, eq(organizations.id, testingRequests.orgId))
      .where(eq(testingRequests.id, id))
    return row ?? null
  })
}

const NEXT: Record<string, { from: TestingStatus[]; to: TestingStatus }> = {
  accept: { from: ["submitted"], to: "accepted" },
  decline: { from: ["submitted"], to: "declined" },
  schedule: { from: ["accepted", "scheduled"], to: "scheduled" },
  start: { from: ["accepted", "scheduled"], to: "in_progress" },
  complete: { from: ["in_progress"], to: "completed" },
}

/** Move a request on, as a Super Admin. Emails the company's Owners and logs it in their timeline. */
export async function advanceRequest(
  id: string,
  step: keyof typeof NEXT,
  input: { note?: string; start?: string; end?: string } = {}
): Promise<Result> {
  const session: Session = await requirePlatform()
  const move = NEXT[step]
  if (!move) return { ok: false, error: "Unknown step." }
  const note = (input.note ?? "").trim().slice(0, 4000)
  if (step === "decline" && !note)
    return { ok: false, error: "Say why it’s declined; the Owner sees this." }
  const start = input.start ? day(input.start) : null
  const end = input.end ? day(input.end) : null
  if (step === "schedule" && (!start || !end || end < start))
    return { ok: false, error: "Choose a start date and an end date after it." }
  try {
    return await withScope(
      { userId: session.user.id, platform: true },
      async (tx): Promise<Result> => {
        const [r] = await tx
          .select({
            status: testingRequests.status,
            orgId: testingRequests.orgId,
            productId: testingRequests.productId,
            productName: products.name,
          })
          .from(testingRequests)
          .innerJoin(products, eq(products.id, testingRequests.productId))
          .where(eq(testingRequests.id, id))
          .for("update", { of: testingRequests })
        if (!r) return { ok: false, error: "Request not found." }
        if (!move.from.includes(r.status as TestingStatus))
          return {
            ok: false,
            error: `It’s ${TESTING_LABELS[r.status as TestingStatus].toLowerCase()}, so that step isn’t possible.`,
          }
        await tx
          .update(testingRequests)
          .set({
            status: move.to,
            ...(step === "accept" ? { assignedTo: session.user.id } : {}),
            ...(step === "decline"
              ? { decisionNote: note }
              : note
                ? { decisionNote: note }
                : {}),
            ...(step === "schedule"
              ? { scheduledStart: start, scheduledEnd: end }
              : {}),
            ...(step === "complete" ? { completedAt: new Date() } : {}),
          })
          .where(eq(testingRequests.id, id))
        if (step === "start" || step === "complete")
          await tx.insert(activityEvents).values({
            orgId: r.orgId,
            productId: r.productId,
            type: "Progress",
            body:
              step === "start"
                ? `Pentest Scout started testing ${r.productName}.`
                : `Pentest Scout completed testing ${r.productName}.${note ? ` ${note}` : ""}`,
            occurredOn: todayIso(),
            authorId: session.user.id,
            authorPlatform: true,
          })
        await audit(
          {
            action: `testing_request.${move.to}`,
            outcome: "success",
            actorId: session.user.id,
            actorRole: "SUPER_ADMIN",
            actorPlatform: true,
            orgId: r.orgId,
            entityType: "testing_request",
            entityId: id,
            productId: r.productId,
            changes: { status: [r.status, move.to] },
          },
          tx
        )
        const [org] = await tx
          .select({ slug: organizations.slug })
          .from(organizations)
          .where(eq(organizations.id, r.orgId))
        const link = await appUrl(`/o/${org.slug}/testing`)
        const when =
          step === "schedule" ? `Scheduled for ${start} to ${end}.` : undefined
        await notifyOwners(tx, r.orgId, (orgName) => ({
          to: "",
          template: "testing_request_update",
          data: {
            orgName,
            productName: r.productName,
            status: TESTING_LABELS[move.to],
            note: [when, note].filter(Boolean).join(" ") || undefined,
            link,
          },
          link,
        }))
        return { ok: true }
      }
    )
  } catch (error) {
    console.error("advance testing request failed", error)
    return { ok: false, error: UNAVAILABLE }
  }
}
