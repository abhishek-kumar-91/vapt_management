import "server-only"

import { and, asc, desc, eq, inArray, isNull, or, sql } from "drizzle-orm"

import {
  activityEvents,
  coverageSnapshots,
  cycleCompletions,
  findings,
  organizations,
  products,
  reports,
  testAreas,
  testingRequests,
} from "@/db/schema"
import type { Tx } from "@/lib/auth/audit"
import { can, canTransition, roleHas, type Permission } from "@/lib/auth/roles"
import { addDays, addWorkdays, todayIso } from "@/lib/dates"
import { meetsCloseoutCriteria, metricsFor } from "@/lib/metrics"
import {
  CYCLE_RULES,
  EXIT_STATUSES,
  RETEST_WORKDAYS,
  SEVERITY_DAYS,
} from "@/lib/sop"
import type {
  ActivityEvent,
  AreaStatus,
  DashboardData,
  EventType,
  Finding,
  FindingRecord,
  FindingStatus,
  NewFindingValues,
  ProductRecord,
  ProductStatus,
  ReportType,
  SavedReport,
  Severity,
  TestArea,
  Tier,
} from "@/lib/types"

import { auditAs, withOrg, type Ctx } from "./context"
import { refreshOrgStats } from "./stats"

/**
 * The VAPT domain on Postgres. loadDashboard returns the same DashboardData shape the browser
 * store has always used (products keyed by slug, findings by key), scoped to what the person
 * may see. Every write re-checks permission and product access on the server, applies the SOP
 * rules (deadlines, retest targets, close-out criteria) here rather than trusting the browser,
 * and records an audit row, the activity event and the coverage snapshot in one transaction.
 */

export type DomainResult<T = object> =
  ({ ok: true } & T) | { ok: false; error: string }

const NOT_ALLOWED = "You don’t have permission to do that."
const NOT_FOUND = "That record no longer exists. Reload the page."
const UNAVAILABLE = "That didn’t save. Check your connection and try again."

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : "")
const isoDay = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 10) : "")
const dateOrNull = (v: string | undefined | null) =>
  v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null

/* ------------------------------------------------------------------- reading */

const seesAll = (ctx: Ctx) => ctx.role === "SUPER_ADMIN" || ctx.role === "OWNER"

/** Product ids this person can see in the company (null = all). */
const visibleIds = (ctx: Ctx) => (seesAll(ctx) ? null : (ctx.productIds as string[]))

async function readOrg(tx: Tx, ctx: Ctx, only?: string[] | null) {
  const filter = only === null || only === undefined ? undefined : inArray(products.id, only.length ? only : [""])
  const [org] = await tx
    .select({ prefix: organizations.findingPrefix, settings: organizations.settings })
    .from(organizations)
    .where(eq(organizations.id, ctx.org.id))
  const productRows = await tx
    .select()
    .from(products)
    .where(and(eq(products.orgId, ctx.org.id), isNull(products.archivedAt), filter))
    .orderBy(asc(products.createdAt))
  const ids = productRows.map((p) => p.id)
  const any = ids.length ? ids : [""]
  const [areas, cycles, findingRows] = await Promise.all([
    tx.select().from(testAreas).where(inArray(testAreas.productId, any)).orderBy(asc(testAreas.position), asc(testAreas.createdAt)),
    tx
      .select({
        productId: cycleCompletions.productId,
        cycleKey: cycleCompletions.cycleKey,
        last: sql<string>`max(${cycleCompletions.completedOn})::text`,
      })
      .from(cycleCompletions)
      .where(inArray(cycleCompletions.productId, any))
      .groupBy(cycleCompletions.productId, cycleCompletions.cycleKey),
    tx.select().from(findings).where(inArray(findings.productId, any)),
  ])
  const slugOf = new Map(productRows.map((p) => [p.id, p.slug]))
  const record: Record<string, ProductRecord> = {}
  for (const p of productRows) {
    record[p.slug] = {
      name: p.name,
      tier: p.tier as Tier,
      status: p.status as ProductStatus,
      domain: p.domain ?? undefined,
      owner: p.ownerName ?? undefined,
      jiraEpic: p.jiraEpic ?? undefined,
      baselineStart: p.baselineStart ?? undefined,
      estDays: p.estDays ?? undefined,
      closeout: p.closeoutOn ?? undefined,
      lastTested: p.lastTestedOn ?? undefined,
      resumeOn: p.resumeOn ?? undefined,
      technology: p.technology ?? undefined,
      dataSensitivity: p.dataSensitivity ?? undefined,
      switchReason: p.switchReason ?? "",
      areas: [],
      done: {},
    }
  }
  for (const a of areas) {
    const slug = slugOf.get(a.productId)
    if (!slug) continue
    const area: TestArea = {
      id: a.id,
      n: a.name,
      hr: a.highRisk,
      s: a.status as AreaStatus,
      j: a.jiraKey ?? undefined,
      method: a.method ?? "",
      result: a.result ?? "",
      notes: a.notes ?? "",
      reason: a.blockedReason ?? "",
      startedAt: isoDay(a.startedAt) || undefined,
      testedAt: isoDay(a.testedAt) || undefined,
    }
    record[slug].areas.push(area)
  }
  for (const c of cycles) {
    const slug = slugOf.get(c.productId)
    if (slug) record[slug].done![c.cycleKey] = c.last
  }
  const findingRecord: Record<string, FindingRecord> = {}
  for (const f of findingRows) {
    const slug = slugOf.get(f.productId)
    if (!slug) continue
    findingRecord[f.key] = {
      product: slug,
      title: f.title,
      severity: f.severity as Severity,
      status: f.status as FindingStatus,
      found: f.foundOn,
      due: f.dueOn ?? "",
      readyDate: isoDay(f.readyForRetestAt),
      retestDue: f.retestDueOn ?? undefined,
      retestRequestedAt: isoDay(f.retestRequestedAt) || undefined,
      retestCompleted: isoDay(f.retestCompletedAt) || undefined,
      closed: isoDay(f.closedAt),
      late: f.late,
      statusReason: f.statusReason ?? "",
      description: f.description ?? undefined,
      steps: f.steps ?? undefined,
      impact: f.impact ?? undefined,
      evidence: f.evidence ?? undefined,
      cvss: f.cvss ?? undefined,
      recommendation: f.recommendation ?? undefined,
      reference: f.reference ?? undefined,
      affectedFeature: f.affectedFeature ?? undefined,
      foundWhile: f.foundWhile ?? undefined,
      environment: f.environment ?? undefined,
      relatedTask: f.relatedTask ?? undefined,
      previousTest: f.previousTest ?? undefined,
      discoveryMethod: f.discoveryMethod ?? undefined,
      lateCause: f.lateCause ?? undefined,
      targetRelease: f.targetRelease ?? undefined,
      exploitationSuspected: f.exploitationSuspected,
      validatedAt: iso(f.validatedAt) || undefined,
      reportedAt: iso(f.reportedAt) || undefined,
      raisedByPlatform: f.raisedByPlatform,
    }
  }
  return { org, productRows, slugOf, record, findingRecord }
}

/** Everything the console shows for this company, limited to what this person may see. */
export async function loadDashboard(ctx: Ctx): Promise<DashboardData> {
  return withOrg(ctx, async (tx) => {
    const only = visibleIds(ctx)
    const { org, productRows, slugOf, record, findingRecord } = await readOrg(tx, ctx, only)
    const ids = productRows.map((p) => p.id)
    const any = ids.length ? ids : [""]
    const productFilter = only === null ? undefined : or(isNull(activityEvents.productId), inArray(activityEvents.productId, any))
    const reportFilter = only === null ? undefined : or(isNull(reports.productId), inArray(reports.productId, any))
    const [events, snapshots, saved] = await Promise.all([
      tx
        .select()
        .from(activityEvents)
        .where(and(eq(activityEvents.orgId, ctx.org.id), productFilter))
        .orderBy(desc(activityEvents.occurredOn), desc(activityEvents.createdAt))
        .limit(500),
      tx
        .select()
        .from(coverageSnapshots)
        .where(inArray(coverageSnapshots.productId, any))
        .orderBy(asc(coverageSnapshots.takenOn)),
      roleHas(ctx.role, "report.read")
        ? tx
            .select()
            .from(reports)
            .where(and(eq(reports.orgId, ctx.org.id), reportFilter))
            .orderBy(asc(reports.createdAt))
        : Promise.resolve([]),
    ])
    const history = new Map<string, Record<string, number>>()
    for (const s of snapshots) {
      const slug = slugOf.get(s.productId)
      if (!slug) continue
      const day = history.get(s.takenOn) ?? {}
      day[slug] = s.coveragePct
      history.set(s.takenOn, day)
    }
    return {
      generated: new Date().toISOString(),
      config: {
        base: org.settings.jiraBaseUrl,
        project: org.prefix,
        retestEmail: org.settings.retestEmail,
      },
      products: record,
      findings: findingRecord,
      events: events.map(
        (e): ActivityEvent => ({
          date: e.occurredOn,
          type: e.type,
          product: e.productId ? (slugOf.get(e.productId) ?? "") : "",
          text: e.body,
        })
      ),
      history: [...history].map(([date, cov]) => ({ date, cov })),
      reports: saved.map(
        (r): SavedReport => ({
          id: r.id,
          type: r.type as ReportType,
          date: r.periodOn,
          title: r.title,
          body: r.body,
        })
      ),
    }
  })
}

/* ------------------------------------------------------------------- helpers */

async function productFor(tx: Tx, ctx: Ctx, slug: string) {
  const [p] = await tx
    .select()
    .from(products)
    .where(and(eq(products.orgId, ctx.org.id), eq(products.slug, slug), isNull(products.archivedAt)))
    .for("update")
  return p ?? null
}

/** The product as the SOP helpers expect it (areas + findings), read inside the transaction. */
async function sopView(tx: Tx, ctx: Ctx, productId: string) {
  const { record, findingRecord, productRows } = await readOrg(tx, ctx, [productId])
  const slug = productRows[0]?.slug
  const product = { id: slug, ...record[slug] }
  const list: Finding[] = Object.entries(findingRecord).map(([id, f]) => ({ id, ...f }))
  return { product, findings: list, metrics: metricsFor(product, list) }
}

async function event(
  tx: Tx,
  ctx: Ctx,
  e: { type: EventType; productId: string | null; text: string; on?: string }
) {
  await tx.insert(activityEvents).values({
    orgId: ctx.org.id,
    productId: e.productId,
    type: e.type,
    body: e.text,
    occurredOn: e.on ?? todayIso(),
    authorId: ctx.user.id,
    authorPlatform: ctx.user.platform,
  })
}

/** Today's coverage for a product (tested areas / all areas), one row per product per day. */
async function snapshot(tx: Tx, ctx: Ctx, productId: string, on = todayIso()) {
  const [row] = await tx
    .select({
      total: sql<number>`count(*)::int`,
      tested: sql<number>`count(*) filter (where ${testAreas.status} = 'Tested')::int`,
    })
    .from(testAreas)
    .where(eq(testAreas.productId, productId))
  if (!row.total) return
  const pct = Math.round((row.tested / row.total) * 100)
  await tx
    .insert(coverageSnapshots)
    .values({ orgId: ctx.org.id, productId, takenOn: on, coveragePct: pct })
    .onConflictDoUpdate({
      target: [coverageSnapshots.productId, coverageSnapshots.takenOn],
      set: { coveragePct: pct },
    })
}

/** Run a product-scoped write: permission check, transaction, stats refresh, errors. */
async function onProduct<T extends object>(
  ctx: Ctx,
  slug: string,
  permission: Permission,
  fn: (tx: Tx, product: typeof products.$inferSelect) => Promise<DomainResult<T>>
): Promise<DomainResult<T>> {
  try {
    return await withOrg(ctx, async (tx) => {
      const product = await productFor(tx, ctx, slug)
      if (!product) return { ok: false, error: NOT_FOUND }
      if (!can(ctx, permission, product.id)) {
        await auditAs(
          ctx,
          { action: `${permission}`, outcome: "denied", entityType: "product", entityId: product.id, productId: product.id },
          tx
        )
        return { ok: false, error: NOT_ALLOWED }
      }
      const result = await fn(tx, product)
      if (result.ok) await refreshOrgStats(tx, ctx.org.id)
      return result
    })
  } catch (error) {
    console.error(`${permission} failed`, error)
    return { ok: false, error: UNAVAILABLE }
  }
}

const has = (v?: string | null) => !!v?.trim()

/* ------------------------------------------------------------------ test areas */

export function setAreaStatus(ctx: Ctx, slug: string, areaId: string, status: AreaStatus) {
  return onProduct(ctx, slug, "area.update", async (tx, product) => {
    const [area] = await tx
      .select()
      .from(testAreas)
      .where(and(eq(testAreas.id, areaId), eq(testAreas.productId, product.id)))
      .for("update")
    if (!area) return { ok: false, error: NOT_FOUND }
    if (area.status === status) return { ok: true }
    const reason = area.blockedReason || area.notes
    if (status === "Tested" && (!has(area.method) || !area.result))
      return { ok: false, error: "Record a method and result before marking it Tested." }
    if (status === "Blocked" && !has(reason))
      return { ok: false, error: "Record a blocker reason before setting it to Blocked." }
    if (area.status === "Blocked" && !has(reason))
      return { ok: false, error: "Record why the blocker was cleared before changing the status." }

    const now = new Date()
    const today = todayIso()
    await tx
      .update(testAreas)
      .set({
        status,
        ...(status === "Blocked" && !area.blockedReason ? { blockedReason: area.notes } : {}),
        ...(status === "In Testing" && !area.startedAt ? { startedAt: now } : {}),
        ...(status === "Tested" ? { testedAt: now } : {}),
      })
      .where(eq(testAreas.id, area.id))
    if (status === "Tested")
      await tx.update(products).set({ lastTestedOn: today }).where(eq(products.id, product.id))
    await event(tx, ctx, {
      type: status === "Blocked" ? "Blocker" : "Progress",
      productId: product.id,
      text: `${area.name}: ${area.status} → ${status}${status === "Tested" ? ` (${area.result}; method: ${area.method})` : ""}${status === "Blocked" ? `; reason: ${reason}` : ""}.`,
    })
    await snapshot(tx, ctx, product.id)
    await auditAs(
      ctx,
      { action: "area.status_changed", outcome: "success", entityType: "test_area", entityId: area.id, productId: product.id, changes: { status: [area.status, status] } },
      tx
    )
    return { ok: true }
  })
}

const AREA_FIELDS = {
  method: "method",
  result: "result",
  notes: "notes",
  reason: "blockedReason",
  j: "jiraKey",
  startedAt: "startedAt",
  testedAt: "testedAt",
} as const

export function setAreaField(
  ctx: Ctx,
  slug: string,
  areaId: string,
  field: keyof typeof AREA_FIELDS,
  raw: string
) {
  return onProduct(ctx, slug, "area.update", async (tx, product) => {
    const column = AREA_FIELDS[field]
    if (!column) return { ok: false, error: "That field can’t be edited." }
    const value = raw.slice(0, 5000)
    let next: string | Date | null = value.trim() ? value : null
    if (column === "result" && next && !["No finding", "Finding raised"].includes(value))
      return { ok: false, error: "Choose No finding or Finding raised." }
    if (column === "startedAt" || column === "testedAt") {
      const day = dateOrNull(value)
      next = day ? new Date(`${day}T00:00:00Z`) : null
    }
    const [area] = await tx
      .select({ id: testAreas.id, status: testAreas.status, before: testAreas[column] })
      .from(testAreas)
      .where(and(eq(testAreas.id, areaId), eq(testAreas.productId, product.id)))
      .for("update")
    if (!area) return { ok: false, error: NOT_FOUND }
    if (column === "blockedReason" && area.status === "Blocked" && !next)
      return { ok: false, error: "A blocked area needs its reason." }
    await tx.update(testAreas).set({ [column]: next }).where(eq(testAreas.id, area.id))
    if (column === "testedAt" && next)
      await tx.update(products).set({ lastTestedOn: value }).where(eq(products.id, product.id))
    await auditAs(
      ctx,
      { action: "area.updated", outcome: "success", entityType: "test_area", entityId: area.id, productId: product.id, changes: { [column]: [area.before, next] } },
      tx
    )
    return { ok: true }
  })
}

/* -------------------------------------------------------------------- products */

const PRODUCT_FIELDS = {
  name: "name",
  tier: "tier",
  domain: "domain",
  owner: "ownerName",
  jiraEpic: "jiraEpic",
  baselineStart: "baselineStart",
  estDays: "estDays",
  closeout: "closeoutOn",
  lastTested: "lastTestedOn",
  resumeOn: "resumeOn",
  technology: "technology",
  dataSensitivity: "dataSensitivity",
  switchReason: "switchReason",
  status: "status",
} as const
export type ProductField = keyof typeof PRODUCT_FIELDS

const DATE_COLUMNS = new Set(["baselineStart", "closeoutOn", "lastTestedOn", "resumeOn"])

export function setProductField(ctx: Ctx, slug: string, field: ProductField, raw: unknown) {
  return onProduct(ctx, slug, "product.edit", async (tx, product) => {
    const column = PRODUCT_FIELDS[field]
    if (!column) return { ok: false, error: "That field can’t be edited." }
    let value: string | number | null = typeof raw === "number" ? raw : String(raw ?? "").slice(0, 2000)
    if (column === "tier") {
      value = Number(raw)
      if (![1, 2, 3].includes(value)) return { ok: false, error: "Tier must be 1, 2 or 3." }
    } else if (column === "estDays") {
      value = raw === "" || raw === null ? null : Math.max(0, Math.round(Number(raw)) || 0)
    } else if (DATE_COLUMNS.has(column)) {
      value = dateOrNull(String(raw ?? ""))
    } else if (column === "name") {
      if (String(value).trim().length < 2) return { ok: false, error: "Enter the product’s name." }
    } else if (column !== "status") {
      value = String(value).trim() ? String(value) : null
    }

    if (column === "status") {
      const next = String(raw) as ProductStatus
      if (next === product.status) return { ok: true }
      const reason = (product.switchReason ?? "").trim()
      if (!reason)
        return { ok: false, error: "Add the Manager-approved reason or handover before changing the status." }
      const view = await sopView(tx, ctx, product.id)
      if (
        (next === "Baseline complete" || next === "Continuous") &&
        (!product.closeoutOn || !meetsCloseoutCriteria(view.product, view.metrics))
      )
        return {
          ok: false,
          error: `${next} needs 100% priority coverage, at least 80% overall, a close-out date, complete finding tickets, and reasons for all untested areas.`,
        }
      await tx.update(products).set({ status: next, switchReason: null }).where(eq(products.id, product.id))
      await event(tx, ctx, {
        type: "Switch",
        productId: product.id,
        text: `Baseline status changed from ${product.status} to ${next}; coverage at change: ${view.metrics.coverage}%. Manager-approved reason / handover: ${reason}`,
      })
      await auditAs(
        ctx,
        { action: "product.status_changed", outcome: "success", entityType: "product", entityId: product.id, productId: product.id, changes: { status: [product.status, next] }, meta: { reason } },
        tx
      )
      return { ok: true }
    }

    const before = product[column as keyof typeof product]
    if (before === value) return { ok: true }
    await tx.update(products).set({ [column]: value }).where(eq(products.id, product.id))
    await auditAs(
      ctx,
      { action: "product.updated", outcome: "success", entityType: "product", entityId: product.id, productId: product.id, changes: { [column]: [before, value] } },
      tx
    )
    return { ok: true }
  })
}

/** Record (or clear, with an empty date) when an SOP cycle was completed. */
export function recordCycle(ctx: Ctx, slug: string, cycleKey: string, date: string) {
  return onProduct(ctx, slug, "cycle.record", async (tx, product) => {
    const rule = CYCLE_RULES.find((r) => r.source === cycleKey)
    if (!rule) return { ok: false, error: "Unknown cycle." }
    const day = dateOrNull(date)
    if (day) {
      await tx
        .insert(cycleCompletions)
        .values({ orgId: ctx.org.id, productId: product.id, cycleKey, completedOn: day, completedBy: ctx.user.id })
        .onConflictDoNothing()
      await tx
        .update(products)
        .set({ lastTestedOn: day, ...(cycleKey === "baseline" ? { closeoutOn: day } : {}) })
        .where(eq(products.id, product.id))
      await event(tx, ctx, { type: "Progress", productId: product.id, text: `${rule.title} recorded as completed on ${day}.` })
    } else {
      const [latest] = await tx
        .select({ on: cycleCompletions.completedOn })
        .from(cycleCompletions)
        .where(and(eq(cycleCompletions.productId, product.id), eq(cycleCompletions.cycleKey, cycleKey)))
        .orderBy(desc(cycleCompletions.completedOn))
        .limit(1)
      if (!latest) return { ok: true }
      await tx
        .delete(cycleCompletions)
        .where(and(eq(cycleCompletions.productId, product.id), eq(cycleCompletions.cycleKey, cycleKey), eq(cycleCompletions.completedOn, latest.on)))
      if (cycleKey === "baseline")
        await tx.update(products).set({ closeoutOn: null }).where(eq(products.id, product.id))
    }
    await auditAs(
      ctx,
      { action: day ? "cycle.recorded" : "cycle.cleared", outcome: "success", entityType: "product", entityId: product.id, productId: product.id, changes: { [cycleKey]: [null, day] } },
      tx
    )
    return { ok: true }
  })
}

/* -------------------------------------------------------------------- findings */

const clip = (v: unknown, max = 10_000) => {
  const s = String(v ?? "").trim()
  return s ? s.slice(0, max) : null
}

/** Raise a finding: key from the company counter, deadlines from the SOP, escalations logged. */
export function createFinding(ctx: Ctx, slug: string, values: NewFindingValues) {
  return onProduct<{ key: string }>(ctx, slug, "finding.create", async (tx, product) => {
    const severities: Severity[] = ["Critical", "High", "Medium", "Low"]
    if (!severities.includes(values.severity)) return { ok: false, error: "Choose a severity." }
    if (!has(values.title)) return { ok: false, error: "Give the finding a title." }
    if (!has(values.affectedFeature)) return { ok: false, error: "Choose the affected feature." }

    const [counter] = await tx
      .update(organizations)
      .set({ nextFindingNo: sql`${organizations.nextFindingNo} + 1` })
      .where(eq(organizations.id, ctx.org.id))
      .returning({ no: sql<number>`${organizations.nextFindingNo} - 1`, prefix: organizations.findingPrefix })
    const key = `${counter.prefix}-${counter.no}`
    const today = todayIso()
    const now = new Date()
    const due =
      values.severity === "Low"
        ? dateOrNull(values.targetRelease)
        : addDays(today, SEVERITY_DAYS[values.severity]!)

    const [request] = ctx.user.platform
      ? await tx
          .select({ id: testingRequests.id })
          .from(testingRequests)
          .where(and(eq(testingRequests.productId, product.id), eq(testingRequests.status, "in_progress")))
          .limit(1)
      : []
    const [area] = await tx
      .select()
      .from(testAreas)
      .where(and(eq(testAreas.productId, product.id), eq(testAreas.name, values.affectedFeature)))
      .for("update")

    await tx.insert(findings).values({
      orgId: ctx.org.id,
      key,
      productId: product.id,
      testAreaId: area?.id ?? null,
      testingRequestId: request?.id ?? null,
      raisedByPlatform: ctx.user.platform,
      title: `[${product.name}][${values.affectedFeature}][${values.severity}] ${values.title.trim()}`.slice(0, 500),
      severity: values.severity,
      status: "Triaged",
      cvss: clip(values.cvss, 200),
      description: clip(values.description),
      steps: clip(values.steps),
      impact: clip(values.impact),
      evidence: clip(values.evidence),
      recommendation: clip(values.recommendation),
      reference: clip(values.reference, 2000),
      affectedFeature: clip(values.affectedFeature, 200),
      foundWhile: clip(values.foundWhile, 500),
      environment: clip(values.environment, 500),
      relatedTask: clip(values.relatedTask, 200),
      previousTest: clip(values.previousTest, 200),
      discoveryMethod: clip(values.discoveryMethod, 2000),
      targetRelease: clip(values.targetRelease, 200),
      late: !!values.late,
      lateCause: clip(values.lateCause, 2000),
      exploitationSuspected: !!values.exploitationSuspected,
      foundOn: today,
      dueOn: due,
      validatedAt: now,
      reportedAt: now,
      reportedBy: ctx.user.id,
    })

    if (values.late && area) {
      await tx
        .update(testAreas)
        .set({
          status: "In Testing",
          startedAt: now,
          method: [area.method, `Late-finding follow-up: ${values.discoveryMethod}`].filter(Boolean).join("\n"),
          notes: `Reopened after ${key}; cause: ${values.lateCause}; previously tested ${values.previousTest}. Check similar features and products.`,
        })
        .where(eq(testAreas.id, area.id))
    }
    await tx.update(products).set({ lastTestedOn: today }).where(eq(products.id, product.id))

    await event(tx, ctx, {
      type: "Finding",
      productId: product.id,
      text: `${values.severity} finding ${key} validated and reported for ${values.affectedFeature}.${values.late ? " Late finding; check similar areas and products." : ""}`,
    })
    if (values.late)
      await event(tx, ctx, {
        type: "Progress",
        productId: product.id,
        text: `Reopened ${values.affectedFeature} after late finding ${key}; cause ${values.lateCause}; previous test ${values.previousTest}; added method: ${values.discoveryMethod}. Retest similar features and products.`,
      })
    if (values.severity === "Critical" || values.severity === "High")
      await event(tx, ctx, {
        type: "Escalation",
        productId: product.id,
        text: `${values.severity} finding ${key} escalated to the development lead and Manager on the validation date.`,
      })
    if (values.exploitationSuspected)
      await event(tx, ctx, {
        type: "Incident",
        productId: product.id,
        text: `Possible production exploitation suspected for ${key}; notify the Manager and development lead immediately and follow the incident process.`,
      })
    await snapshot(tx, ctx, product.id)
    await auditAs(
      ctx,
      { action: "finding.created", outcome: "success", entityType: "finding", entityId: key, productId: product.id, changes: { severity: [null, values.severity], status: [null, "Triaged"] } },
      tx
    )
    return { ok: true, key }
  })
}

/** Move a finding along the allowed transitions. Refusals are audited as denied. */
export async function setFindingStatus(
  ctx: Ctx,
  key: string,
  status: FindingStatus,
  reason = "",
  opts: { retestRequest?: boolean } = {}
): Promise<DomainResult> {
  try {
    return await withOrg(ctx, async (tx): Promise<DomainResult> => {
      const [f] = await tx
        .select()
        .from(findings)
        .where(and(eq(findings.orgId, ctx.org.id), eq(findings.key, key)))
        .for("update")
      if (!f || (!seesAll(ctx) && !ctx.productIds.includes(f.productId)))
        return { ok: false, error: NOT_FOUND }
      if (f.status === status) return { ok: true }
      if (!canTransition(ctx, f.productId, f.status as FindingStatus, status)) {
        await auditAs(
          ctx,
          { action: "finding.status_changed", outcome: "denied", entityType: "finding", entityId: key, productId: f.productId, changes: { status: [f.status, status] } },
          tx
        )
        return { ok: false, error: `You can’t move ${key} from ${f.status} to ${status}.` }
      }
      const trimmed = reason.trim().slice(0, 2000)
      if (EXIT_STATUSES.includes(status) && !trimmed)
        return { ok: false, error: `${status} needs a recorded reason.` }

      const now = new Date()
      const today = todayIso()
      const retestDue = addWorkdays(today, RETEST_WORKDAYS)
      await tx
        .update(findings)
        .set({
          status,
          ...(status === "Ready for Retest"
            ? { readyForRetestAt: now, retestDueOn: retestDue, retestRequestedAt: now }
            : {}),
          ...(status === "Closed"
            ? { closedAt: now, ...(f.status === "Ready for Retest" ? { retestCompletedAt: now } : {}) }
            : {}),
          ...(EXIT_STATUSES.includes(status) ? { statusReason: trimmed, closedAt: now } : {}),
          ...(["Open", "Triaged", "In Fix"].includes(status) ? { closedAt: null, statusReason: null } : {}),
        })
        .where(eq(findings.id, f.id))
      await event(tx, ctx, {
        type: status === "Ready for Retest" ? "Retest" : "Finding",
        productId: f.productId,
        text: opts.retestRequest
          ? `Retest requested for ${key}; response target ${retestDue} (2 working days).`
          : `${key} status changed from ${f.status} to ${status}${trimmed ? `; reason: ${trimmed}` : ""}.`,
      })
      await refreshOrgStats(tx, ctx.org.id)
      await auditAs(
        ctx,
        { action: "finding.status_changed", outcome: "success", entityType: "finding", entityId: key, productId: f.productId, changes: { status: [f.status, status] }, meta: trimmed ? { reason: trimmed } : undefined },
        tx
      )
      return { ok: true }
    })
  } catch (error) {
    console.error("finding status failed", error)
    return { ok: false, error: UNAVAILABLE }
  }
}

/* --------------------------------------------------------------------- reports */

export async function saveReport(
  ctx: Ctx,
  report: { type: ReportType; date: string; title: string; body: string; productSlug?: string }
): Promise<DomainResult> {
  if (!roleHas(ctx.role, "report.generate")) return { ok: false, error: NOT_ALLOWED }
  const day = dateOrNull(report.date)
  if (!day) return { ok: false, error: "Choose the report date." }
  try {
    return await withOrg(ctx, async (tx): Promise<DomainResult> => {
      const product = report.productSlug ? await productFor(tx, ctx, report.productSlug) : null
      if (product && !can(ctx, "report.generate", product.id)) return { ok: false, error: NOT_ALLOWED }
      if (!product && !seesAll(ctx) && report.type === "closeout") return { ok: false, error: NOT_ALLOWED }
      await tx.insert(reports).values({
        orgId: ctx.org.id,
        productId: product?.id ?? null,
        type: report.type,
        periodOn: day,
        title: report.title.slice(0, 300),
        body: report.body.slice(0, 200_000),
        generatedBy: ctx.user.id,
      })
      if (report.type === "closeout" && product) {
        const view = await sopView(tx, ctx, product.id)
        if (meetsCloseoutCriteria({ ...view.product, closeout: day }, view.metrics)) {
          await tx.update(products).set({ closeoutOn: day }).where(eq(products.id, product.id))
          await tx
            .insert(cycleCompletions)
            .values({ orgId: ctx.org.id, productId: product.id, cycleKey: "baseline", completedOn: day, completedBy: ctx.user.id })
            .onConflictDoNothing()
        }
      }
      if (report.type === "weekly") {
        const ids = await tx
          .select({ id: products.id })
          .from(products)
          .where(and(eq(products.orgId, ctx.org.id), isNull(products.archivedAt)))
        for (const { id } of ids) await snapshot(tx, ctx, id, day)
      }
      await event(tx, ctx, { type: "Report", productId: product?.id ?? null, text: `${report.title} saved for ${day}.`, on: day })
      await auditAs(
        ctx,
        { action: "report.generated", outcome: "success", entityType: "report", entityId: report.type, productId: product?.id ?? null },
        tx
      )
      return { ok: true }
    })
  } catch (error) {
    console.error("save report failed", error)
    return { ok: false, error: UNAVAILABLE }
  }
}

/** A full export of what this person can see, recorded in the audit log. */
export async function exportDashboard(ctx: Ctx) {
  const data = await loadDashboard(ctx)
  await withOrg(ctx, (tx) =>
    auditAs(ctx, { action: "data.exported", outcome: "success", entityType: "organization", entityId: ctx.org.id }, tx)
  )
  return data
}
