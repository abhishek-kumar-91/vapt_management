import { randomUUID } from "node:crypto"

import { and, eq, sql } from "drizzle-orm"
import { beforeAll, describe, expect, test } from "vitest"

import { db } from "@/db"
import {
  authTokens,
  memberships,
  organizations,
  products,
  testAreas,
  users,
} from "@/db/schema"
import type { OrgRole } from "@/lib/auth/roles"
import type { Ctx } from "@/server/context"
import {
  createAccessLink,
  inviteMember,
  listMembers,
  setMemberStatus,
  updateMember,
} from "@/server/members"

const tag = randomUUID().slice(0, 8)
const email = (who: string) => `${who}-${tag}@test.local`

async function company(slug: string) {
  const [org] = await db
    .insert(organizations)
    .values({
      name: slug,
      slug: `${slug}-${tag}`,
      status: "active",
      findingPrefix: slug.toUpperCase().slice(0, 6),
    })
    .returning()
  return org
}

async function person(who: string, org: { id: string }, role: OrgRole) {
  const [u] = await db
    .insert(users)
    .values({
      email: email(who),
      name: who,
      passwordHash: "scrypt$x",
      status: "active",
    })
    .returning()
  await db.insert(memberships).values({
    orgId: org.id,
    userId: u.id,
    role,
    status: "active",
    joinedAt: new Date(),
  })
  return u
}

function ctxFor(
  u: { id: string; name: string; email: string },
  org: Awaited<ReturnType<typeof company>>,
  role: Ctx["role"],
  platform = false
): Ctx {
  return {
    sessionId: "test",
    user: { id: u.id, name: u.name, email: u.email, platform },
    org: { id: org.id, slug: org.slug, name: org.name, status: org.status },
    role,
    productIds: [],
    editProductIds: [],
    productSlugs: {},
  }
}

let a: Awaited<ReturnType<typeof company>>
let b: Awaited<ReturnType<typeof company>>
let ownerA: Awaited<ReturnType<typeof person>>
let devA: Awaited<ReturnType<typeof person>>
let ownerB: Awaited<ReturnType<typeof person>>

beforeAll(async () => {
  process.env.APP_URL = "http://app.test"
  a = await company("alpha")
  b = await company("beta")
  ownerA = await person("owner-a", a, "OWNER")
  devA = await person("dev-a", a, "DEVELOPER")
  ownerB = await person("owner-b", b, "OWNER")
})

describe("company isolation", () => {
  test("a company's team list contains only its own members", async () => {
    const result = await listMembers(ctxFor(ownerA, a, "OWNER"))
    expect(result.ok).toBe(true)
    const emails = result.ok ? result.users.map((u) => u.email) : []
    expect(emails).toEqual(expect.arrayContaining([ownerA.email, devA.email]))
    expect(emails).not.toContain(ownerB.email)
  })

  test("an Owner can't change a member of another company", async () => {
    const asA = ctxFor(ownerA, a, "OWNER")
    expect(
      await updateMember(asA, ownerB.id, {
        name: ownerB.name,
        email: ownerB.email,
        role: "DEVELOPER",
      })
    ).toEqual({ ok: false, error: expect.stringMatching(/permission/) })
    expect(await setMemberStatus(asA, ownerB.id, "suspended")).toMatchObject({
      ok: false,
    })
    expect(await createAccessLink(asA, ownerB.id)).toMatchObject({ ok: false })
  })

  test("a row can't point at another company's product", async () => {
    const [p] = await db
      .insert(products)
      .values({ orgId: a.id, slug: "web", name: "Web", tier: 1 })
      .returning()
    await expect(
      db.insert(testAreas).values({ orgId: b.id, productId: p.id, name: "Auth" })
    ).rejects.toThrow()
    await db.insert(testAreas).values({ orgId: a.id, productId: p.id, name: "Auth" })
  })
})

describe("roles and guards", () => {
  test("developers can't see the team", async () => {
    expect(await listMembers(ctxFor(devA, a, "DEVELOPER"))).toMatchObject({
      ok: false,
    })
  })

  test("a Manager can't invite an Owner", async () => {
    const mgr = await person("mgr-a", a, "MANAGER")
    expect(
      await inviteMember(ctxFor(mgr, a, "MANAGER"), {
        name: "X",
        email: email("x"),
        role: "OWNER",
      })
    ).toMatchObject({ ok: false })
  })

  test("the last active Owner can't be suspended, even by a Super Admin", async () => {
    const [admin] = await db
      .insert(users)
      .values({ email: email("admin"), name: "Admin", status: "invited" })
      .returning()
    const result = await setMemberStatus(
      ctxFor(admin, b, "SUPER_ADMIN", true),
      ownerB.id,
      "suspended"
    )
    expect(result).toEqual({
      ok: false,
      error: "A company needs at least one active Owner.",
    })
  })

  test("only the CLI can grant platform_role", async () => {
    await expect(
      db.insert(users).values({
        email: email("sneaky"),
        name: "Sneaky",
        platformRole: "SUPER_ADMIN",
      })
    ).rejects.toThrow()
  })

  test("audit_logs is append-only", async () => {
    await db.execute(
      sql`insert into audit_logs (action, outcome) values ('test.row', 'success')`
    )
    await expect(db.execute(sql`delete from audit_logs`)).rejects.toThrow()
    await expect(
      db.execute(sql`update audit_logs set action = 'x'`)
    ).rejects.toThrow()
  })
})

describe("invites", () => {
  test("inviting a new email creates a pending member and a one-time link", async () => {
    const result = await inviteMember(ctxFor(ownerA, a, "OWNER"), {
      name: "New Tester",
      email: email("new"),
      role: "SECURITY_TESTER",
    })
    expect(result).toMatchObject({
      ok: true,
      link: expect.stringMatching(/^http:\/\/app\.test\/set-password\//),
      expiresInHours: 72,
    })
    const [row] = await db
      .select({ status: memberships.status, role: memberships.role })
      .from(memberships)
      .innerJoin(users, eq(users.id, memberships.userId))
      .where(and(eq(memberships.orgId, a.id), eq(users.email, email("new"))))
    expect(row).toEqual({ status: "invited", role: "SECURITY_TESTER" })
  })

  test("an existing account joins a second company through /invite", async () => {
    const result = await inviteMember(ctxFor(ownerB, b, "OWNER"), {
      name: devA.name,
      email: devA.email,
      role: "DEVELOPER",
    })
    expect(result).toMatchObject({
      ok: true,
      link: expect.stringMatching(/\/invite\//),
    })
    const tokens = await db
      .select({ orgId: authTokens.orgId })
      .from(authTokens)
      .where(eq(authTokens.userId, devA.id))
    expect(tokens).toEqual([{ orgId: b.id }])
  })

  test("the same email can't be invited twice to one company", async () => {
    expect(
      await inviteMember(ctxFor(ownerA, a, "OWNER"), {
        name: "Again",
        email: email("NEW").toLowerCase(),
        role: "DEVELOPER",
      })
    ).toEqual({ ok: false, error: "Someone with this email already has access." })
  })

  test("only they can change their name once they've joined", async () => {
    expect(
      await updateMember(ctxFor(ownerA, a, "OWNER"), devA.id, {
        name: "Renamed",
        email: devA.email,
        role: "DEVELOPER",
      })
    ).toMatchObject({ ok: false, error: expect.stringMatching(/Only they/) })
  })
})
