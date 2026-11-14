import type { OrgRole, Permission } from "./auth/roles"
import { EMAIL_PATTERN } from "./auth/shared"

export const EMAIL = EMAIL_PATTERN

/** A member as the Team page sees it (from GET /api/users). Never includes hashes or tokens. */
export interface TeamUser {
  id: string
  name: string
  email: string
  role: OrgRole
  status: UserStatus
  createdAt: string
  lastLoginAt: string | null
}

export type UserStatus = "active" | "invited" | "suspended"

export const USER_STATUSES: UserStatus[] = ["active", "invited", "suspended"]

export const STATUS_LABELS: Record<UserStatus, string> = {
  active: "Active",
  invited: "Invite pending",
  suspended: "Suspended",
}

/** Rows of the "What each role can do" table; ticks come from the real matrix in lib/auth/roles.ts. */
export const PERMISSION_ROWS: { label: string; permission: Permission }[] = [
  { label: "View products, coverage and findings", permission: "finding.read" },
  {
    label: "Update test areas, methods and results",
    permission: "area.update",
  },
  { label: "Raise and edit findings", permission: "finding.create" },
  {
    label: "Move findings to In Fix and request retests",
    permission: "finding.transition",
  },
  { label: "Edit product details and record cycles", permission: "product.edit" },
  { label: "Generate and save reports", permission: "report.generate" },
  { label: "Invite members and change roles", permission: "member.manage" },
  { label: "Add products and request Pentest Scout testing", permission: "product.create" },
  { label: "Change company settings", permission: "org.manage" },
  { label: "Read the company audit log", permission: "org.audit" },
]

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const letters =
    parts.length > 1
      ? parts[0][0] + parts[parts.length - 1][0]
      : name.slice(0, 2)
  return letters.toUpperCase() || "?"
}
