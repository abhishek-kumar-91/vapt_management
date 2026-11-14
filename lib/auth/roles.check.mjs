// Run: pnpm test:roles. Fails loudly if the permission matrix drifts from the agreed rules.
import assert from "node:assert/strict"

import {
  can,
  canManageUser,
  canTransition,
  MANAGEABLE_ROLES,
  ROLE_LABELS,
  ROLES,
} from "./roles.ts"

const actor = (role, productIds = []) => ({ role, productIds })
const P = "product-a"

assert.deepEqual(
  [...ROLES],
  ["SUPER_ADMIN", "OWNER", "MANAGER", "SECURITY_TESTER", "DEVELOPER"]
)
assert.throws(
  () => {
    ROLE_LABELS.OWNER = "x"
  },
  TypeError,
  "labels are frozen"
)
assert.throws(
  () => {
    MANAGEABLE_ROLES.MANAGER = ["SUPER_ADMIN"]
  },
  TypeError,
  "manageable roles are frozen"
)

// Admin powers: SUPER_ADMIN and OWNER only
for (const p of ["settings.manage", "audit.read"]) {
  for (const r of ["SUPER_ADMIN", "OWNER"])
    assert.ok(can(actor(r), p), `${r} ${p}`)
  for (const r of ["MANAGER", "SECURITY_TESTER", "DEVELOPER"])
    assert.ok(!can(actor(r, [P]), p, P), `${r} ${p}`)
}
for (const r of ["SECURITY_TESTER", "DEVELOPER"])
  assert.ok(!can(actor(r), "user.read"), `${r} can't list users`)

// Nobody can create, edit or become SUPER_ADMIN from the app
const sa = { id: "sa", role: "SUPER_ADMIN" }
const owner = { id: "o", role: "OWNER" }
for (const r of ROLES)
  assert.ok(!MANAGEABLE_ROLES[r].includes("SUPER_ADMIN"), r)
assert.ok(!canManageUser(owner, sa), "owner can't touch super admin")
assert.ok(!canManageUser(sa, sa), "not even yourself")
assert.ok(canManageUser(sa, owner))
assert.ok(canManageUser(owner, { id: "o2", role: "OWNER" }, "MANAGER"))
assert.ok(!canManageUser(owner, owner, "MANAGER"), "no self role change")
const mgr = { id: "m", role: "MANAGER" }
assert.ok(canManageUser(mgr, { id: "d", role: "DEVELOPER" }, "SECURITY_TESTER"))
assert.ok(
  !canManageUser(mgr, { id: "d", role: "DEVELOPER" }, "MANAGER"),
  "no promoting to own level"
)
assert.ok(!canManageUser(mgr, owner), "manager can't touch owners")

// Developers: assigned products only, can only move In Fix → Ready for Retest
assert.ok(!can(actor("DEVELOPER"), "finding.read", P))
assert.ok(can(actor("DEVELOPER", [P]), "finding.read", P))
assert.ok(!can(actor("DEVELOPER", [P]), "finding.create", P))
assert.ok(
  canTransition(actor("DEVELOPER", [P]), P, "In Fix", "Ready for Retest")
)
assert.ok(
  !canTransition(actor("DEVELOPER", [P]), P, "Ready for Retest", "Closed")
)
assert.ok(
  !canTransition(actor("DEVELOPER"), P, "In Fix", "Ready for Retest"),
  "unassigned dev"
)

// Testers: read everything, write assigned; exits are staff-only
assert.ok(can(actor("SECURITY_TESTER"), "finding.read", P))
assert.ok(!can(actor("SECURITY_TESTER"), "finding.create", P))
assert.ok(
  canTransition(actor("SECURITY_TESTER", [P]), P, "Ready for Retest", "Closed")
)
assert.ok(
  !canTransition(actor("SECURITY_TESTER", [P]), P, "Open", "Risk Accepted")
)
assert.ok(canTransition(actor("MANAGER"), P, "Open", "Risk Accepted"))
assert.ok(
  !canTransition(actor("MANAGER"), P, "Closed", "Risk Accepted"),
  "not from closed"
)

console.log("roles: all checks passed")
