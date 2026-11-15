export type Severity = "Critical" | "High" | "Medium" | "Low"
export type AreaStatus = "To Do" | "In Testing" | "Blocked" | "Tested"
export type FindingStatus =
  | "Open"
  | "Triaged"
  | "In Fix"
  | "Ready for Retest"
  | "Closed"
  | "Rejected"
  | "Risk Accepted"
  | "Won't Fix"
export type ProductStatus =
  "Not started" | "In progress" | "Paused" | "Baseline complete" | "Continuous"
export type Health = "Green" | "Amber" | "Red" | "Paused" | "Not started"
export type Tier = 1 | 2 | 3

export interface TestArea {
  /** Database id (set for areas loaded from the server). */
  id?: string
  /** Area name */
  n: string
  /** High-risk (priority) area */
  hr: boolean
  /** Status */
  s: AreaStatus
  /** Jira task key */
  j?: string
  method?: string
  result?: "" | "No finding" | "Finding raised"
  notes?: string
  reason?: string
  startedAt?: string
  testedAt?: string
}

export interface ProductRecord {
  name: string
  tier: Tier
  status: ProductStatus
  domain?: string
  owner?: string
  jiraEpic?: string
  baselineStart?: string
  estDays?: number
  closeout?: string
  lastTested?: string
  resumeOn?: string
  technology?: string
  dataSensitivity?: string
  switchReason?: string
  example?: boolean
  areas: TestArea[]
  done?: Record<string, string>
}

export interface Product extends ProductRecord {
  id: string
}

export interface FindingRecord {
  product: string
  title: string
  severity: Severity
  status: FindingStatus
  found: string
  due?: string
  readyDate?: string
  retestDue?: string
  retestRequestedAt?: string
  retestCompleted?: string
  retestDate?: string
  closed?: string
  late?: boolean
  statusReason?: string
  description?: string
  steps?: string
  impact?: string
  evidence?: string
  cvss?: string
  recommendation?: string
  reference?: string
  affectedFeature?: string
  foundWhile?: string
  environment?: string
  relatedTask?: string
  previousTest?: string
  discoveryMethod?: string
  lateCause?: string
  targetRelease?: string
  exploitationSuspected?: boolean
  validatedAt?: string
  reportedAt?: string
  /** Raised by a Pentest Scout admin (shown as "Raised by Pentest Scout"). */
  raisedByPlatform?: boolean
}

export interface Finding extends FindingRecord {
  id: string
}

export type EventType =
  | "Progress"
  | "Finding"
  | "Escalation"
  | "Retest"
  | "Report"
  | "Switch"
  | "Close-out"
  | "Blocker"
  | "Incident"
  | "Access"

export interface ActivityEvent {
  date: string
  type: EventType | string
  product?: string
  text: string
}

export interface CoverageSnapshot {
  date: string
  cov: Record<string, number>
}

export type ReportType = "daily" | "weekly" | "monthly" | "closeout"

export interface SavedReport {
  id: string
  type: ReportType
  date: string
  title: string
  body: string
}

export interface DashboardData {
  generated: string
  config: { base?: string; project?: string; retestEmail?: string }
  products: Record<string, ProductRecord>
  findings: Record<string, FindingRecord>
  events: ActivityEvent[]
  history: CoverageSnapshot[]
  reports?: SavedReport[]
}

export interface NewFindingValues {
  title: string
  affectedFeature: string
  foundWhile: string
  relatedTask: string
  severity: Severity
  cvss: string
  description: string
  steps: string
  impact: string
  evidence: string
  environment: string
  reference: string
  recommendation: string
  late: boolean
  previousTest: string
  discoveryMethod: string
  lateCause: string
  targetRelease: string
  exploitationSuspected: boolean
}
