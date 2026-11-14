/**
 * Fixed roles and what each may do. This file is the only place permissions are defined.
 * Roles are a Postgres enum, so no one can add, rename or edit a role at runtime;
 * changing this matrix is a code change that goes through review.
 * Self-contained (type-only imports) so the DB schema, server, client and CLI can all import it.
 */
import type { FindingStatus } from "../types"

/** Highest first. SUPER_ADMIN is the platform team's single account; customers start at OWNER. */
export const ROLES = [
  "SUPER_ADMIN",
  "OWNER",
  "MANAGER",
  "SECURITY_TESTER",
  "DEVELOPER",
] as const
export type Role = (typeof ROLES)[number]

export const ROLE_LABELS: Readonly<Record<Role, string>> = Object.freeze({
  SUPER_ADMIN: "Super Admin",
  OWNER: "Owner",
  MANAGER: "Manager",
  SECURITY_TESTER: "Security Tester",
  DEVELOPER: "Developer",
})

export const ROLE_SUMMARIES: Readonly<Record<Role, string>> = Object.freeze({
  SUPER_ADMIN: "Platform administrator. Full access, including Owners.",
  OWNER: "Manages users, roles and settings, plus everything a Manager can do.",
  MANAGER:
    "Runs the programme: products, reports, exits like Risk Accepted, and invites testers and developers.",
  SECURITY_TESTER:
    "Tests areas, raises findings, runs retests and saves reports.",
  DEVELOPER:
    "Sees findings on assigned products, moves them to In Fix and requests retests.",
})

/**
 * "all": any product. "assigned": only products the user is a member of.
 * A role missing from a permission has no access to it.
 */
type Scope = "all" | "assigned"

const ALL = "all" as const
const ADMINS = { SUPER_ADMIN: ALL, OWNER: ALL }
const STAFF = { ...ADMINS, MANAGER: ALL }

const MATRIX = {
  "product.read": { ...STAFF, SECURITY_TESTER: "all", DEVELOPER: "assigned" },
  "product.manage": STAFF,
  "area.update": { ...STAFF, SECURITY_TESTER: "assigned" },
  "cycle.record": { ...STAFF, SECURITY_TESTER: "assigned" },
  "activity.write": { ...STAFF, SECURITY_TESTER: "assigned" },
  "finding.read": { ...STAFF, SECURITY_TESTER: "all", DEVELOPER: "assigned" },
  "finding.create": { ...STAFF, SECURITY_TESTER: "assigned" },
  "finding.edit": { ...STAFF, SECURITY_TESTER: "assigned" },
  "finding.transition": {
    ...STAFF,
    SECURITY_TESTER: "assigned",
    DEVELOPER: "assigned",
  },
  "report.generate": { ...STAFF, SECURITY_TESTER: "all" },
  "report.read": { ...STAFF, SECURITY_TESTER: "all" },
  "member.assign": STAFF,
  /** See the Users page. Which rows they can change is MANAGEABLE_ROLES. */
  "user.read": STAFF,
  "user.manage": STAFF,
  "settings.manage": ADMINS,
  "audit.read": ADMINS,
} as const satisfies Record<string, Partial<Record<Role, Scope>>>

export type Permission = keyof typeof MATRIX

/**
 * Roles each role may invite, edit, suspend or assign. Nobody can create or change a
 * SUPER_ADMIN from the app: there is exactly one, created from the CLI.
 */
export const MANAGEABLE_ROLES: Readonly<Record<Role, readonly Role[]>> =
  Object.freeze({
    SUPER_ADMIN: ["OWNER", "MANAGER", "SECURITY_TESTER", "DEVELOPER"],
    OWNER: ["OWNER", "MANAGER", "SECURITY_TESTER", "DEVELOPER"],
    MANAGER: ["SECURITY_TESTER", "DEVELOPER"],
    SECURITY_TESTER: [],
    DEVELOPER: [],
  })

const ACTIVE: FindingStatus[] = [
  "Open",
  "Triaged",
  "In Fix",
  "Ready for Retest",
]
const STAFF_ROLES: readonly Role[] = ["SUPER_ADMIN", "OWNER", "MANAGER"]
const TESTING: readonly Role[] = [...STAFF_ROLES, "SECURITY_TESTER"]

/** Allowed finding status moves. Anything not listed is refused (and audited as denied). */
export const FINDING_TRANSITIONS: ReadonlyArray<{
  from: readonly FindingStatus[]
  to: FindingStatus
  roles: readonly Role[]
}> = Object.freeze([
  { from: ["Open"], to: "Triaged", roles: TESTING },
  {
    from: ["Open", "Triaged", "Ready for Retest"],
    to: "In Fix",
    roles: [...TESTING, "DEVELOPER"],
  },
  {
    from: ["In Fix"],
    to: "Ready for Retest",
    roles: [...TESTING, "DEVELOPER"],
  },
  { from: ["Ready for Retest"], to: "Closed", roles: TESTING },
  { from: ["Closed"], to: "Open", roles: TESTING },
  { from: ACTIVE, to: "Rejected", roles: STAFF_ROLES },
  { from: ACTIVE, to: "Risk Accepted", roles: STAFF_ROLES },
  { from: ACTIVE, to: "Won't Fix", roles: STAFF_ROLES },
])

export interface Actor {
  role: Role
  /** Product ids the user is a member of. */
  productIds: readonly string[]
}

/** Does this role have the permission at all (any scope)? For showing or hiding UI. */
export function roleHas(role: Role, permission: Permission): boolean {
  return role in MATRIX[permission]
}

/** Can this actor do this? Pass productId for product-scoped actions. */
export function can(
  actor: Actor,
  permission: Permission,
  productId?: string
): boolean {
  const scope = (MATRIX[permission] as Partial<Record<Role, Scope>>)[actor.role]
  if (!scope) return false
  if (scope === "all") return true
  return productId !== undefined && actor.productIds.includes(productId)
}

export function canTransition(
  actor: Actor,
  productId: string,
  from: FindingStatus,
  to: FindingStatus
): boolean {
  if (!can(actor, "finding.transition", productId)) return false
  return FINDING_TRANSITIONS.some(
    (t) => t.to === to && t.from.includes(from) && t.roles.includes(actor.role)
  )
}

/** May `actor` change a user who has `targetRole`, optionally moving them to `nextRole`? Never themselves. */
export function canManageUser(
  actor: { id: string; role: Role },
  target: { id: string; role: Role },
  nextRole?: Role
): boolean {
  if (actor.id === target.id) return false
  const allowed = MANAGEABLE_ROLES[actor.role]
  return (
    allowed.includes(target.role) && (!nextRole || allowed.includes(nextRole))
  )
}
