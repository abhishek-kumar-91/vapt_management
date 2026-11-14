import { pgEnum } from "drizzle-orm/pg-core"

import { ROLES } from "../../lib/auth/roles"
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

export const userRole = pgEnum("user_role", ROLES)
export const userStatus = pgEnum("user_status", [
  "invited",
  "active",
  "suspended",
  "deactivated",
])
export const tokenPurpose = pgEnum("token_purpose", [
  "invite",
  "password_reset",
])

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
] satisfies Tuple<EventType>)
export const reportType = pgEnum("report_type", [
  "daily",
  "weekly",
  "monthly",
  "closeout",
] satisfies Tuple<ReportType>)

export const auditOutcome = pgEnum("audit_outcome", [
  "success",
  "denied",
  "failure",
])
