import assert from "node:assert/strict"
import { test } from "vitest"

import {
  can,
  canManageUser,
  canTransition,
  MANAGEABLE_ROLES,
  ORG_ROLES,
  ROLE_LABELS,
  roleHas,
  ROLES,
  type Role,
} from "./roles"

/** An actor with view access to `view` products and edit access to `edit` products. */
const actor = (role: Role, view: string[] = [], edit: string[] = []) => ({
  role,
  productIds: [...new Set([...view, ...edit])],
  editProductIds: edit,
})
const P = "product-a"
const Q = "product-b"

test("roles are fixed and frozen", () => {
  assert.deepEqual(
    [...ROLES],
    ["SUPER_ADMIN", "OWNER", "MANAGER", "SECURITY_TESTER", "DEVELOPER"]
  )
  assert.deepEqual(
    [...ORG_ROLES],
    ["OWNER", "MANAGER", "SECURITY_TESTER", "DEVELOPER"]
  )
  assert.throws(() => {
    ;(ROLE_LABELS as Record<string, string>).OWNER = "x"
  }, TypeError)
  assert.throws(() => {
    ;(MANAGEABLE_ROLES as Record<string, readonly Role[]>).MANAGER = [
      "OWNER",
    ]
  }, TypeError)
})

test("SUPER_ADMIN passes every check in every company", () => {
  const sa = actor("SUPER_ADMIN")
  for (const p of [
    "org.manage",
    "org.audit",
    "product.create",
    "finding.create",
    "finding.transition",
  ] as const) {
    assert.ok(can(sa, p, P), p)
    assert.ok(roleHas("SUPER_ADMIN", p), p)
  }
  assert.ok(canTransition(sa, P, "Open", "Risk Accepted"))
  assert.ok(!canTransition(sa, P, "Closed", "Risk Accepted"), "still a valid move only")
})

test("company-wide powers are the Owner's only", () => {
  for (const p of [
    "org.manage",
    "org.audit",
    "product.create",
    "product.archive",
    "testing.request",
  ] as const) {
    assert.ok(can(actor("OWNER"), p), `OWNER ${p}`)
    for (const r of ["MANAGER", "SECURITY_TESTER", "DEVELOPER"] as const)
      assert.ok(!can(actor(r, [P], [P]), p, P), `${r} ${p}`)
  }
  for (const r of ["SECURITY_TESTER", "DEVELOPER"] as const)
    assert.ok(!roleHas(r, "member.read"), `${r} can't see the team`)
})

test("Owners cover every product without assignment", () => {
  const owner = actor("OWNER")
  assert.ok(can(owner, "product.edit", P))
  assert.ok(can(owner, "finding.create", Q))
  assert.ok(can(owner, "member.assign", P))
})

test("view access reads; edit access changes", () => {
  const viewer = actor("SECURITY_TESTER", [P])
  assert.ok(can(viewer, "finding.read", P))
  assert.ok(!can(viewer, "finding.create", P), "view can't raise findings")
  assert.ok(!can(viewer, "area.update", P))
  assert.ok(!can(viewer, "finding.read", Q), "unassigned product is invisible")

  const editor = actor("SECURITY_TESTER", [], [P])
  assert.ok(can(editor, "finding.read", P), "edit implies view")
  assert.ok(can(editor, "finding.create", P))
  assert.ok(can(editor, "area.update", P))
  assert.ok(!can(editor, "product.edit", P), "testers don't edit product details")

  const manager = actor("MANAGER", [Q], [P])
  assert.ok(can(manager, "product.edit", P))
  assert.ok(!can(manager, "product.edit", Q), "view-only product")
  assert.ok(can(manager, "member.assign", P))
  assert.ok(!can(manager, "member.assign", Q))
})

test("nobody manages SUPER_ADMIN or themselves", () => {
  const sa = { id: "sa", role: "SUPER_ADMIN" as const }
  const owner = { id: "o", role: "OWNER" as const }
  for (const r of ROLES)
    assert.ok(!(MANAGEABLE_ROLES[r] as readonly Role[]).includes("SUPER_ADMIN"), r)
  assert.ok(!canManageUser(owner, sa), "owner can't touch super admin")
  assert.ok(canManageUser(sa, owner), "super admin manages owners")
  assert.ok(!canManageUser(sa, sa), "not even yourself")
  assert.ok(canManageUser(owner, { id: "o2", role: "OWNER" }, "MANAGER"))
  assert.ok(!canManageUser(owner, owner, "MANAGER"), "no self role change")
  const mgr = { id: "m", role: "MANAGER" as const }
  assert.ok(canManageUser(mgr, { id: "d", role: "DEVELOPER" }, "SECURITY_TESTER"))
  assert.ok(
    !canManageUser(mgr, { id: "d", role: "DEVELOPER" }, "MANAGER"),
    "no promoting to own level"
  )
  assert.ok(!canManageUser(mgr, owner), "manager can't touch owners")
})

test("developers: edit access, In Fix → Ready for Retest only", () => {
  assert.ok(!can(actor("DEVELOPER"), "finding.read", P))
  assert.ok(can(actor("DEVELOPER", [P]), "finding.read", P))
  assert.ok(!can(actor("DEVELOPER", [], [P]), "finding.create", P))
  assert.ok(
    canTransition(actor("DEVELOPER", [], [P]), P, "In Fix", "Ready for Retest")
  )
  assert.ok(
    !canTransition(actor("DEVELOPER", [P]), P, "In Fix", "Ready for Retest"),
    "view-only developer"
  )
  assert.ok(
    !canTransition(actor("DEVELOPER", [], [P]), P, "Ready for Retest", "Closed")
  )
})

test("exits (Rejected, Risk Accepted, Won't Fix) are Owner and Manager only", () => {
  assert.ok(
    canTransition(actor("SECURITY_TESTER", [], [P]), P, "Ready for Retest", "Closed")
  )
  assert.ok(
    !canTransition(actor("SECURITY_TESTER", [], [P]), P, "Open", "Risk Accepted")
  )
  assert.ok(canTransition(actor("MANAGER", [], [P]), P, "Open", "Risk Accepted"))
  assert.ok(canTransition(actor("OWNER"), P, "Triaged", "Won't Fix"))
  assert.ok(
    !canTransition(actor("MANAGER", [], [P]), P, "Closed", "Risk Accepted"),
    "not from closed"
  )
})
