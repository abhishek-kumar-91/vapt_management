import { pgEnum } from "drizzle-orm/pg-core"

import { ORG_ROLES, PLATFORM_ROLES, PRODUCT_ACCESS } from "../../lib/auth/roles"
import {
  AREA_STATUSES,
  FINDING_STATUSES,
  PRODUCT_STATUSES,
  SEVERITIES,
} from "../../lib/sop"
import type { EventType, ReportType } from "../../lib/types"

// Value lists come from the same constants the app uses, so code and database can't drift.
type Tuple<T> = [T, ...T[]]
const tuple = <T>(values: readonly T[]) => values as Tuple<T>

// Identity and tenancy
export const platformRole = pgEnum("platform_role", tuple(PLATFORM_ROLES))
export const orgRole = pgEnum("org_role", tuple(ORG_ROLES))
export const productAccess = pgEnum("product_access", tuple(PRODUCT_ACCESS))
/** invited: has no password yet (accepts through an invite link). disabled: blocked platform-wide. */
export const userStatus = pgEnum("user_status", [
  "invited",
  "active",
  "disabled",
])
export const membershipStatus = pgEnum("membership_status", [
  "invited",
  "active",
  "suspended",
  "removed",
])
export const orgStatus = pgEnum("org_status", [
  "draft",
  "pending_review",
  "active",
  "rejected",
  "suspended",
  "closed",
])
export const tokenPurpose = pgEnum("token_purpose", [
  "email_verify",
  "org_invite",
  "password_reset",
])

// VAPT domain
export const productStatus = pgEnum("product_status", tuple(PRODUCT_STATUSES))
export const areaStatus = pgEnum("area_status", tuple(AREA_STATUSES))
export const areaResult = pgEnum("area_result", [
  "No finding",
  "Finding raised",
])
export const severity = pgEnum("severity", tuple(SEVERITIES))
export const findingStatus = pgEnum("finding_status", tuple(FINDING_STATUSES))
export const eventType = pgEnum("event_type", [
  "Progress",
  "Finding",
  "Escalation",
  "Retest",
  "Report",
  "Switch",
  "Close-out",
  "Blocker",
  "Incident",
  "Access",
] satisfies Tuple<EventType>)
export const reportType = pgEnum("report_type", [
  "daily",
  "weekly",
  "monthly",
  "closeout",
] satisfies Tuple<ReportType>)
export const testingRequestStatus = pgEnum("testing_request_status", [
  "submitted",
  "accepted",
  "declined",
  "scheduled",
  "in_progress",
  "completed",
  "cancelled",
])

// Platform
export const emailStatus = pgEnum("email_status", [
  "pending",
  "sent",
  "failed",
  "cancelled",
])
export const auditOutcome = pgEnum("audit_outcome", [
  "success",
  "denied",
  "failure",
])
