/**
 * Fixed roles and what each may do. This file is the only place permissions are defined.
 * Roles are Postgres enums, so no one can add, rename or edit a role at runtime;
 * changing this matrix is a code change that goes through review.
 * Self-contained (type-only imports) so the DB schema, server, client and CLI can all import it.
 *
 * Two layers decide access (docs/database-architecture.md §4):
 *  1. The role says what *kind* of thing someone may do.
 *  2. Product access (view | edit, set by the Owner) says *which* products they may do it on.
 * SUPER_ADMIN is a platform role, not a company role: it passes every check in every company.
 */
import type { FindingStatus } from "../types"

/** Every role, highest first. SUPER_ADMIN lives on users.platform_role; the rest on memberships.role. */
export const ROLES = [
  "SUPER_ADMIN",
  "OWNER",
  "MANAGER",
  "SECURITY_TESTER",
  "DEVELOPER",
] as const
export type Role = (typeof ROLES)[number]

export const PLATFORM_ROLES = ["SUPER_ADMIN"] as const
export type PlatformRole = (typeof PLATFORM_ROLES)[number]

/** Roles a person can hold inside a company. */
export const ORG_ROLES = [
  "OWNER",
  "MANAGER",
  "SECURITY_TESTER",
  "DEVELOPER",
] as const
export type OrgRole = (typeof ORG_ROLES)[number]

export const PRODUCT_ACCESS = ["view", "edit"] as const
export type Access = (typeof PRODUCT_ACCESS)[number]

export const ROLE_LABELS: Readonly<Record<Role, string>> = Object.freeze({
  SUPER_ADMIN: "Super Admin",
  OWNER: "Owner",
  MANAGER: "Manager",
  SECURITY_TESTER: "Security Tester",
  DEVELOPER: "Developer",
})

export const ROLE_SUMMARIES: Readonly<Record<Role, string>> = Object.freeze({
  SUPER_ADMIN:
    "Pentest Scout administrator. Full access to every company, always audited.",
  OWNER:
    "Runs the company account: settings, products, team and who can edit what.",
  MANAGER:
    "Runs testing on the products they can edit, and invites testers and developers.",
  SECURITY_TESTER:
    "Tests areas, raises findings and runs retests on the products they can edit.",
  DEVELOPER:
    "Sees findings on their products and moves them to In Fix and Ready for Retest.",
})

/**
 * true: the role has it (not product-scoped).
 * "all": on every product in the company.
 * "view": on products the person can view or edit.
 * "edit": only on products the person can edit.
 * A role missing from a permission has no access to it.
 */
type Rule = true | "all" | "view" | "edit"

const EVERYONE_VIEWS = {
  OWNER: "all",
  MANAGER: "view",
  SECURITY_TESTER: "view",
  DEVELOPER: "view",
} as const
const TESTERS_EDIT = {
  OWNER: "all",
  MANAGER: "edit",
  SECURITY_TESTER: "edit",
} as const

const MATRIX = {
  "org.manage": { OWNER: true },
  "org.audit": { OWNER: true },
  "product.create": { OWNER: true },
  "product.archive": { OWNER: true },
  "testing.request": { OWNER: true },
  /** See the Team page. Which rows they can change is MANAGEABLE_ROLES. */
  "member.read": { OWNER: true, MANAGER: true },
  "member.manage": { OWNER: true, MANAGER: true },
  "member.assign": { OWNER: "all", MANAGER: "edit" },
  "product.read": EVERYONE_VIEWS,
  "product.edit": { OWNER: "all", MANAGER: "edit" },
  "cycle.record": { OWNER: "all", MANAGER: "edit" },
  "area.update": TESTERS_EDIT,
  "activity.write": TESTERS_EDIT,
  "finding.read": EVERYONE_VIEWS,
  "finding.create": TESTERS_EDIT,
  "finding.edit": TESTERS_EDIT,
  "finding.transition": { ...TESTERS_EDIT, DEVELOPER: "edit" },
  "report.generate": { OWNER: "all", MANAGER: "view", SECURITY_TESTER: "view" },
  "report.read": { OWNER: "all", MANAGER: "view", SECURITY_TESTER: "view" },
} as const satisfies Record<string, Partial<Record<OrgRole, Rule>>>

export type Permission = keyof typeof MATRIX

/**
 * Company roles each role may invite, edit, suspend or assign. Nobody manages SUPER_ADMIN
 * from the app: those accounts are created by `pnpm user:create` only.
 */
export const MANAGEABLE_ROLES: Readonly<Record<Role, readonly OrgRole[]>> =
  Object.freeze({
    SUPER_ADMIN: ORG_ROLES,
    OWNER: ORG_ROLES,
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
const STAFF: readonly OrgRole[] = ["OWNER", "MANAGER"]
const TESTING: readonly OrgRole[] = [...STAFF, "SECURITY_TESTER"]

/** Allowed finding status moves. Anything not listed is refused (and audited as denied). */
export const FINDING_TRANSITIONS: ReadonlyArray<{
  from: readonly FindingStatus[]
  to: FindingStatus
  roles: readonly OrgRole[]
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
  { from: ACTIVE, to: "Rejected", roles: STAFF },
  { from: ACTIVE, to: "Risk Accepted", roles: STAFF },
  { from: ACTIVE, to: "Won't Fix", roles: STAFF },
])

export interface Actor {
  /** SUPER_ADMIN for platform admins, otherwise their role in the current company. */
  role: Role
  /** Products they can view or edit (ignored for OWNER and SUPER_ADMIN, who see all). */
  productIds: readonly string[]
  /** Products they can edit. */
  editProductIds: readonly string[]
}

/** Does this role have the permission at all (any scope)? For showing or hiding UI. */
export function roleHas(role: Role, permission: Permission): boolean {
  return role === "SUPER_ADMIN" || role in MATRIX[permission]
}

/** Can this actor do this? Pass productId for product-scoped actions. */
export function can(
  actor: Actor,
  permission: Permission,
  productId?: string
): boolean {
  if (actor.role === "SUPER_ADMIN") return true
  const rule = (MATRIX[permission] as Partial<Record<OrgRole, Rule>>)[
    actor.role
  ]
  if (!rule) return false
  if (rule === true || rule === "all") return true
  if (productId === undefined) return false
  return (rule === "view" ? actor.productIds : actor.editProductIds).includes(
    productId
  )
}

export function canTransition(
  actor: Actor,
  productId: string,
  from: FindingStatus,
  to: FindingStatus
): boolean {
  if (!can(actor, "finding.transition", productId)) return false
  return FINDING_TRANSITIONS.some(
    (t) =>
      t.to === to &&
      t.from.includes(from) &&
      (actor.role === "SUPER_ADMIN" ||
        t.roles.includes(actor.role as OrgRole))
  )
}

/** May `actor` change a member who has `targetRole`, optionally moving them to `nextRole`? Never themselves. */
export function canManageUser(
  actor: { id: string; role: Role },
  target: { id: string; role: Role },
  nextRole?: Role
): boolean {
  if (actor.id === target.id) return false
  const allowed: readonly Role[] = MANAGEABLE_ROLES[actor.role]
  return (
    allowed.includes(target.role) && (!nextRole || allowed.includes(nextRole))
  )
}

export const isOrgRole = (value: unknown): value is OrgRole =>
  (ORG_ROLES as readonly unknown[]).includes(value)
