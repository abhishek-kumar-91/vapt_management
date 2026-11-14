import { randomUUID } from "node:crypto"

import { and, eq } from "drizzle-orm"
import { beforeAll, describe, expect, test } from "vitest"

import { db } from "@/db"
import {
  activityEvents,
  auditLogs,
  findings,
  memberships,
  organizations,
  orgStats,
  productMembers,
  products,
  testAreas,
  users,
} from "@/db/schema"
import type { OrgRole } from "@/lib/auth/roles"
import { addDays, todayIso } from "@/lib/dates"
import { SEVERITY_DAYS } from "@/lib/sop"
import type { NewFindingValues } from "@/lib/types"
import type { Ctx } from "@/server/context"
import {
  createFinding,
  loadDashboard,
  setAreaStatus,
  setFindingStatus,
} from "@/server/domain"
import { createProduct } from "@/server/products"

const tag = randomUUID().slice(0, 8)
let org: typeof organizations.$inferSelect
let productId = ""
let otherProductId = ""
const people: Record<string, Ctx> = {}

async function member(name: string, role: OrgRole, access: Record<string, "view" | "edit"> = {}) {
  const [u] = await db
    .insert(users)
    .values({ email: `${name}-${tag}@test.local`, name, passwordHash: "x", status: "active" })
    .returning()
  await db.insert(memberships).values({ orgId: org.id, userId: u.id, role, status: "active" })
  for (const [pid, level] of Object.entries(access))
    await db.insert(productMembers).values({ orgId: org.id, productId: pid, userId: u.id, access: level })
  const [p] = await db.select({ slug: products.slug, id: products.id }).from(products).where(eq(products.orgId, org.id))
  people[name] = {
    sessionId: "t",
    user: { id: u.id, name, email: u.email, platform: false },
    org: { id: org.id, slug: org.slug, name: org.name, status: "active" },
    role,
    productIds: Object.keys(access),
    editProductIds: Object.entries(access).filter(([, l]) => l === "edit").map(([id]) => id),
    productSlugs: { [p.id]: p.slug },
  }
}

const finding = (over: Partial<NewFindingValues> = {}): NewFindingValues => ({
  title: "Payout amount can be changed after approval",
  affectedFeature: "Payments and transactions",
  foundWhile: "",
  relatedTask: "",
  severity: "High",
  cvss: "",
  description: "d",
  steps: "s",
  impact: "i",
  evidence: "e",
  environment: "staging",
  reference: "",
  recommendation: "r",
  late: false,
  previousTest: "",
  discoveryMethod: "",
  lateCause: "",
  targetRelease: "",
  exploitationSuspected: false,
  ...over,
})

beforeAll(async () => {
  ;[org] = await db
    .insert(organizations)
    .values({ name: "Domain Co", slug: `domain-${tag}`, status: "active", findingPrefix: "DOM" })
    .returning()
  const [owner] = await db
    .insert(users)
    .values({ email: `owner-${tag}@test.local`, name: "Owner", passwordHash: "x", status: "active" })
    .returning()
  await db.insert(memberships).values({ orgId: org.id, userId: owner.id, role: "OWNER", status: "active" })
  people.owner = {
    sessionId: "t",
    user: { id: owner.id, name: "Owner", email: owner.email, platform: false },
    org: { id: org.id, slug: org.slug, name: org.name, status: "active" },
    role: "OWNER",
    productIds: [],
    editProductIds: [],
    productSlugs: {},
  }
  for (const name of ["Web", "Back office"]) {
    const form = new FormData()
    form.set("name", name)
    form.set("tier", "1")
    expect(await createProduct(people.owner, form)).toMatchObject({ ok: true })
  }
  const rows = await db.select().from(products).where(eq(products.orgId, org.id))
  productId = rows.find((r) => r.name === "Web")!.id
  otherProductId = rows.find((r) => r.name === "Back office")!.id
  await member("tester", "SECURITY_TESTER", { [productId]: "edit" })
  await member("viewer", "SECURITY_TESTER", { [productId]: "view" })
  await member("dev", "DEVELOPER", { [productId]: "edit" })
})

describe("products", () => {
  test("a new product starts with its tier's test areas", async () => {
    const areas = await db.select().from(testAreas).where(eq(testAreas.productId, productId))
    expect(areas.length).toBe(23)
  })

  test("people see only the products they have access to", async () => {
    const data = await loadDashboard(people.viewer)
    expect(Object.keys(data.products)).toEqual(["web"])
    const all = await loadDashboard(people.owner)
    expect(Object.keys(all.products).sort()).toEqual(["back-office", "web"])
  })
})

describe("findings", () => {
  let key = ""

  test("raising one numbers it per company, sets the SOP deadline and logs the escalation", async () => {
    const result = await createFinding(people.tester, "web", finding())
    expect(result).toEqual({ ok: true, key: "DOM-1" })
    key = "DOM-1"
    const [f] = await db.select().from(findings).where(and(eq(findings.orgId, org.id), eq(findings.key, key)))
    expect(f.dueOn).toBe(addDays(todayIso(), SEVERITY_DAYS.High!))
    expect(f.status).toBe("Triaged")
    const events = await db.select({ type: activityEvents.type }).from(activityEvents).where(eq(activityEvents.productId, productId))
    expect(events.map((e) => e.type)).toEqual(expect.arrayContaining(["Finding", "Escalation"]))
    const [stats] = await db.select().from(orgStats).where(eq(orgStats.orgId, org.id))
    expect(stats.openHigh).toBe(1)
  })

  test("view access can't raise findings, and the refusal is audited", async () => {
    expect(await createFinding(people.viewer, "web", finding())).toEqual({
      ok: false,
      error: expect.stringMatching(/permission/),
    })
    const denied = await db
      .select()
      .from(auditLogs)
      .where(and(eq(auditLogs.orgId, org.id), eq(auditLogs.outcome, "denied")))
    expect(denied.length).toBeGreaterThan(0)
  })

  test("nobody can raise a finding on a product they can't see", async () => {
    expect(await createFinding(people.tester, "back-office", finding())).toMatchObject({ ok: false })
  })

  test("developers move findings to In Fix and Ready for Retest, nothing else", async () => {
    expect(await setFindingStatus(people.dev, key, "In Fix")).toEqual({ ok: true })
    expect(await setFindingStatus(people.dev, key, "Closed")).toMatchObject({ ok: false })
    expect(await setFindingStatus(people.dev, key, "Ready for Retest")).toEqual({ ok: true })
    const [f] = await db.select().from(findings).where(eq(findings.key, key))
    expect(f.retestDueOn).toBeTruthy()
  })

  test("exits need an Owner or Manager and a reason", async () => {
    const second = await createFinding(people.tester, "web", finding({ severity: "Low", targetRelease: "2026-12-31" }))
    expect(second).toEqual({ ok: true, key: "DOM-2" })
    expect(await setFindingStatus(people.tester, "DOM-2", "Risk Accepted", "fine")).toMatchObject({ ok: false })
    expect(await setFindingStatus(people.owner, "DOM-2", "Risk Accepted")).toMatchObject({ ok: false })
    expect(await setFindingStatus(people.owner, "DOM-2", "Risk Accepted", "Compensating control in place")).toEqual({ ok: true })
  })
})

describe("test areas", () => {
  test("Tested needs a method and a result first", async () => {
    const [area] = await db.select().from(testAreas).where(eq(testAreas.productId, productId)).limit(1)
    expect(await setAreaStatus(people.tester, "web", area.id, "Tested")).toMatchObject({ ok: false })
    expect(await setAreaStatus(people.tester, "web", area.id, "In Testing")).toEqual({ ok: true })
  })

  test("developers can't change test areas", async () => {
    const [area] = await db.select().from(testAreas).where(eq(testAreas.productId, productId)).limit(1)
    expect(await setAreaStatus(people.dev, "web", area.id, "To Do")).toMatchObject({ ok: false })
  })

  test("areas of another product aren't reachable through this one", async () => {
    const [foreign] = await db.select().from(testAreas).where(eq(testAreas.productId, otherProductId)).limit(1)
    expect(await setAreaStatus(people.owner, "web", foreign.id, "In Testing")).toMatchObject({ ok: false })
  })
})

describe("testing by Pentest Scout", () => {
  test("a Super Admin's finding during an engagement is linked and labelled", async () => {
    const { testingRequests } = await import("@/db/schema")
    const [request] = await db
      .insert(testingRequests)
      .values({
        orgId: org.id,
        productId,
        requestedBy: people.owner.user.id,
        scope: "Web app and API",
        status: "in_progress",
      })
      .returning({ id: testingRequests.id })
    const admin: Ctx = {
      ...people.owner,
      user: { ...people.owner.user, platform: true },
      role: "SUPER_ADMIN",
    }
    const result = await createFinding(admin, "web", finding({ severity: "Medium" }))
    expect(result).toMatchObject({ ok: true })
    const key = (result as { key: string }).key
    const [f] = await db.select().from(findings).where(and(eq(findings.orgId, org.id), eq(findings.key, key)))
    expect(f.raisedByPlatform).toBe(true)
    expect(f.testingRequestId).toBe(request.id)
    const data = await loadDashboard(people.owner)
    expect(data.findings[key].raisedByPlatform).toBe(true)
  })
})
