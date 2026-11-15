/** Workflow rules from the Application Security Testing SOP v1.0. */
import type {
  AreaStatus,
  FindingStatus,
  ProductStatus,
  Severity,
} from "./types"

export const PRODUCT_ORDER = [
  "remplatforms-wallet",
  "storesofindia",
  "indiandeliverypartners",
  "reminterns",
  "remlearners",
]

export const SEVERITIES: Severity[] = ["Critical", "High", "Medium", "Low"]
export const AREA_STATUSES: AreaStatus[] = [
  "To Do",
  "In Testing",
  "Blocked",
  "Tested",
]
export const FINDING_STATUSES: FindingStatus[] = [
  "Open",
  "Triaged",
  "In Fix",
  "Ready for Retest",
  "Closed",
  "Rejected",
  "Risk Accepted",
  "Won't Fix",
]
export const ACTIVE_FINDING_STATUSES: FindingStatus[] = [
  "Open",
  "Triaged",
  "In Fix",
  "Ready for Retest",
]
export const EXIT_STATUSES: FindingStatus[] = [
  "Rejected",
  "Risk Accepted",
  "Won't Fix",
]
export const CLOSED_STATUSES: FindingStatus[] = ["Closed", ...EXIT_STATUSES]
export const PRODUCT_STATUSES: ProductStatus[] = [
  "Not started",
  "In progress",
  "Paused",
  "Baseline complete",
  "Continuous",
]

/** Fix deadline in calendar days after validation; Low is due next release. */
export const SEVERITY_DAYS: Partial<Record<Severity, number>> = {
  Critical: 7,
  High: 30,
  Medium: 90,
}
export const RETEST_WORKDAYS = 2
export const CLOSEOUT_COVERAGE = 80
export const TIER_WEIGHT: Record<number, number> = { 1: 3, 2: 2, 3: 1 }
export const SEVERITY_WEIGHT: Record<Severity, number> = {
  Critical: 10,
  High: 5,
  Medium: 2,
  Low: 0.5,
}

export interface CycleRule {
  key: string
  title: string
  source: string
  months?: Record<number, number>
  days?: Record<number, number>
  eventBased?: boolean
}

export const CYCLE_RULES: CycleRule[] = [
  {
    key: "baseline",
    title: "Baseline test",
    months: { 1: 12, 2: 12, 3: 12 },
    source: "baseline",
  },
  {
    key: "release",
    title: "New-feature security review",
    eventBased: true,
    source: "release",
  },
  {
    key: "regression",
    title: "Regression test",
    months: { 1: 1, 2: 3, 3: 6 },
    source: "regression",
  },
  {
    key: "auth",
    title: "Authentication retest",
    months: { 1: 3, 2: 6, 3: 12 },
    source: "auth",
  },
  {
    key: "dep",
    title: "Dependency scan",
    days: { 1: 7, 2: 7, 3: 30 },
    source: "dep",
  },
  {
    key: "config",
    title: "Configuration review",
    months: { 1: 3, 2: 6, 3: 12 },
    source: "config",
  },
  {
    key: "register",
    title: "Product register review",
    months: { 1: 1, 2: 1, 3: 1 },
    source: "register",
  },
]

export const SOP_RULES = [
  "Test-area coverage = Tested tasks ÷ all tasks. Priority coverage uses only high-risk tasks.",
  "Baseline completion requires 100% priority coverage, at least 80% overall, and a recorded close-out date.",
  "Fix targets: Critical 7 days; High 30 days; Medium 90 days; Low by the next release.",
  "Critical/High findings escalate the same day. Retest target: 2 working days after the fix is ready.",
  "Tier cycles: regression monthly / quarterly / every 6 months; auth quarterly / every 6 months / yearly; dependency weekly / weekly / monthly; configuration quarterly / every 6 months / yearly.",
  "Health: Red for critical overdue, >20 points behind, overdue cycle or missed baseline; Amber for high overdue, up to 20 points behind, paused, or stalled 3 working days.",
  "Areas are time-boxed: change approach after 1 day in testing; after 2 days, move to another area and record a reason.",
  "Daily, weekly, monthly and close-out reports are generated from live records and archived locally.",
]

/** Test areas every new product starts with; high-risk ones count toward priority coverage. */
const AREA_TEMPLATE: { name: string; highRisk: boolean; minTier: 1 | 2 | 3 }[] = [
  { name: "Authentication and login", highRisk: true, minTier: 3 },
  { name: "Password reset", highRisk: true, minTier: 3 },
  { name: "OTP and two-factor", highRisk: true, minTier: 3 },
  { name: "Session management", highRisk: true, minTier: 3 },
  { name: "Access control (IDOR)", highRisk: true, minTier: 3 },
  { name: "Privilege escalation", highRisk: true, minTier: 3 },
  { name: "Input validation and injection", highRisk: false, minTier: 3 },
  { name: "API authorisation", highRisk: true, minTier: 3 },
  { name: "Rate limiting and brute force", highRisk: false, minTier: 3 },
  { name: "Payments and transactions", highRisk: true, minTier: 3 },
  { name: "Business logic", highRisk: false, minTier: 3 },
  { name: "File upload", highRisk: false, minTier: 3 },
  { name: "Error handling", highRisk: false, minTier: 3 },
  { name: "Security headers", highRisk: false, minTier: 3 },
  { name: "TLS and cipher settings", highRisk: false, minTier: 3 },
  { name: "CORS configuration", highRisk: false, minTier: 3 },
  { name: "Sensitive data exposure", highRisk: true, minTier: 3 },
  { name: "Admin panel", highRisk: true, minTier: 3 },
  { name: "Third-party integrations", highRisk: false, minTier: 2 },
  { name: "Webhooks", highRisk: false, minTier: 2 },
  { name: "Logging and monitoring", highRisk: false, minTier: 1 },
  { name: "Dependency review", highRisk: false, minTier: 1 },
  { name: "Cloud configuration", highRisk: false, minTier: 1 },
]

/** Starting areas for a tier: tier 1 (most critical) gets the full list, tier 3 the core. */
export const areasForTier = (tier: 1 | 2 | 3) =>
  AREA_TEMPLATE.filter((a) => tier <= a.minTier)

/** Lower-case URL key: "Stores of India!" → "stores-of-india". */
export const slugify = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/, "")
