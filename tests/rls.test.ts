import { randomUUID } from "node:crypto"

import { sql } from "drizzle-orm"
import { beforeAll, describe, expect, test } from "vitest"

import { db } from "@/db"
import {
  activityEvents,
  findings,
  memberships,
  organizations,
  products,
  testAreas,
  users,
} from "@/db/schema"

/**
 * Row-level security, exercised as the app's restricted role (app_user). The test connection is
 * the table owner, so each case switches role inside a transaction that it then rolls back.
 */

const tag = randomUUID().slice(0, 8)
let a: { id: string }
let b: { id: string }
let alice: { id: string }

/** Run `fn` as app_user with the given scope, then roll everything back. */
async function asApp<T>(
  scope: { org?: string; user?: string; platform?: boolean },
  fn: (tx: Parameters<Parameters<typeof db.transaction>[0]>[0]) => Promise<T>
): Promise<T> {
  let out: T
  await db
    .transaction(async (tx) => {
      await tx.execute(sql`set local role app_user`)
      await tx.execute(sql`select
        set_config('app.org_id', ${scope.org ?? ""}, true),
        set_config('app.user_id', ${scope.user ?? ""}, true),
        set_config('app.platform', ${scope.platform ? "on" : "off"}, true)`)
      out = await fn(tx)
      throw new Rollback()
    })
    .catch((e) => {
      if (!(e instanceof Rollback)) throw e
    })
  return out!
}
class Rollback extends Error {}

beforeAll(async () => {
  for (const [slug, prefix] of [["rls-a", "RLSA"], ["rls-b", "RLSB"]] as const) {
    const [org] = await db
      .insert(organizations)
      .values({ name: slug, slug: `${slug}-${tag}`, status: "active", findingPrefix: prefix })
      .returning({ id: organizations.id })
    const [p] = await db
      .insert(products)
      .values({ orgId: org.id, slug: "web", name: `${slug} web`, tier: 1 })
      .returning({ id: products.id })
    await db.insert(testAreas).values({ orgId: org.id, productId: p.id, name: "Auth" })
    await db.insert(findings).values({
      orgId: org.id,
      key: `${prefix}-1`,
      productId: p.id,
      title: "t",
      severity: "High",
      foundOn: "2026-11-01",
    })
    await db.insert(activityEvents).values({ orgId: org.id, productId: p.id, type: "Progress", body: "x", occurredOn: "2026-11-01" })
    if (slug === "rls-a") a = org
    else b = org
  }
  ;[alice] = await db
    .insert(users)
    .values({ email: `alice-${tag}@test.local`, name: "Alice", passwordHash: "x", status: "active" })
    .returning({ id: users.id })
  await db.insert(memberships).values({ orgId: a.id, userId: alice.id, role: "OWNER", status: "active" })
})

const TABLES = { products, testAreas, findings, activityEvents } as const

describe("as app_user", () => {
  test.each(Object.keys(TABLES))("%s: a company scope sees only its own rows", async (name) => {
    const table = TABLES[name as keyof typeof TABLES]
    const orgs = await asApp({ org: a.id }, async (tx) =>
      (await tx.select({ orgId: table.orgId }).from(table)).map((r) => r.orgId)
    )
    expect(orgs.length).toBeGreaterThan(0)
    expect(new Set(orgs)).toEqual(new Set([a.id]))
  })

  test("no scope sees no company rows at all", async () => {
    const n = await asApp({}, async (tx) => (await tx.select({ id: findings.id }).from(findings)).length)
    expect(n).toBe(0)
  })

  test("platform scope sees every company", async () => {
    const orgs = await asApp({ platform: true }, async (tx) =>
      new Set((await tx.select({ orgId: products.orgId }).from(products)).map((r) => r.orgId))
    )
    expect(orgs.has(a.id) && orgs.has(b.id)).toBe(true)
  })

  test("a person sees the companies they belong to, and no others", async () => {
    const ids = await asApp({ user: alice.id }, async (tx) =>
      (await tx.select({ id: organizations.id }).from(organizations)).map((r) => r.id)
    )
    expect(ids).toContain(a.id)
    expect(ids).not.toContain(b.id)
  })

  test("writing into another company is refused", async () => {
    await expect(
      asApp({ org: a.id }, (tx) =>
        tx.insert(products).values({ orgId: b.id, slug: "sneaky", name: "Sneaky", tier: 1 })
      )
    ).rejects.toThrow()
  })

  test("updates can't reach another company's rows", async () => {
    const changed = await asApp({ org: a.id }, async (tx) =>
      (await tx.update(findings).set({ title: "pwned" }).where(sql`true`).returning({ orgId: findings.orgId })).map((r) => r.orgId)
    )
    expect(changed).not.toContain(b.id)
  })

  test("the audit log can't be edited or deleted", async () => {
    await db.execute(sql`insert into audit_logs (action, outcome) values ('rls.test', 'success')`)
    await expect(asApp({ platform: true }, (tx) => tx.execute(sql`delete from audit_logs`))).rejects.toThrow()
    await expect(asApp({ platform: true }, (tx) => tx.execute(sql`update audit_logs set action = 'x'`))).rejects.toThrow()
  })
})
