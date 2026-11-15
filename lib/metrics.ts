import {
  addDays,
  addMonths,
  addWorkdays,
  isWorkday,
  todayIso,
  workdaysBetween,
} from "./dates"
import {
  CLOSED_STATUSES,
  CLOSEOUT_COVERAGE,
  CYCLE_RULES,
  EXIT_STATUSES,
  RETEST_WORKDAYS,
  SEVERITIES,
  SEVERITY_WEIGHT,
  TIER_WEIGHT,
  type CycleRule,
} from "./sop"
import type {
  AreaStatus,
  CoverageSnapshot,
  Finding,
  Health,
  Product,
  ProductRecord,
  Severity,
} from "./types"

export function isClosed(finding: Pick<Finding, "status">) {
  return CLOSED_STATUSES.includes(finding.status)
}

export function retestDueFor(finding: Finding) {
  return (
    finding.retestDue ||
    (finding.readyDate ? addWorkdays(finding.readyDate, RETEST_WORKDAYS) : "")
  )
}

export type AreaCounts = Record<AreaStatus, number>

export function areaCounts(areas: ProductRecord["areas"] = []): AreaCounts {
  const counts: AreaCounts = {
    Tested: 0,
    "In Testing": 0,
    Blocked: 0,
    "To Do": 0,
  }
  areas.forEach((area) => {
    counts[area.s] = (counts[area.s] ?? 0) + 1
  })
  return counts
}

export interface CycleRow extends CycleRule {
  last: string
  next: string
  eventBased: boolean
  frequency: string
}

export function cycleRows(product: ProductRecord): CycleRow[] {
  return CYCLE_RULES.map((rule) => {
    const done = product.done || {}
    const last =
      done[rule.source] ||
      (rule.source === "baseline"
        ? product.closeout || product.baselineStart
        : "") ||
      (rule.source === "register" ? product.lastTested : "") ||
      ""
    const interval = rule.months?.[product.tier] ?? 0
    const next =
      last && !rule.eventBased
        ? rule.days
          ? addDays(last, rule.days[product.tier])
          : addMonths(last, interval)
        : ""
    const frequency = rule.eventBased
      ? "Every release"
      : rule.days
        ? rule.days[product.tier] === 7
          ? "Weekly"
          : "Monthly"
        : (
            {
              1: "Monthly",
              3: "Quarterly",
              6: "Every 6 months",
              12: "Yearly",
            } as Record<number, string>
          )[interval] || `${interval} months`
    return { ...rule, last, next, eventBased: !!rule.eventBased, frequency }
  })
}

export function metricsFor(product: Product, findings: Finding[]) {
  const areas = product.areas || []
  const highRisk = areas.filter((area) => area.hr)
  const counts = areaCounts(areas)
  const tested = counts.Tested
  const priorityTested = highRisk.filter((area) => area.s === "Tested").length
  const productFindings = findings.filter(
    (finding) => finding.product === product.id
  )
  const open = productFindings.filter((finding) => !isClosed(finding))
  const count = Object.fromEntries(
    SEVERITIES.map((severity) => [
      severity,
      open.filter((finding) => finding.severity === severity).length,
    ])
  ) as Record<Severity, number>
  const risk =
    SEVERITIES.reduce(
      (sum, severity) => sum + count[severity] * SEVERITY_WEIGHT[severity],
      0
    ) * (TIER_WEIGHT[product.tier] || 1)
  const today = todayIso()
  const overdueCritical = open.some(
    (f) => f.severity === "Critical" && !!f.due && f.due < today
  )
  const overdueHigh = open.some(
    (f) => f.severity === "High" && !!f.due && f.due < today
  )
  const overdueRetest = productFindings.some((f) => {
    const due = retestDueFor(f)
    return f.status === "Ready for Retest" && !!due && due < today
  })
  const coverage = areas.length ? Math.round((tested / areas.length) * 100) : 0
  const priorityCoverage = highRisk.length
    ? Math.round((priorityTested / highRisk.length) * 100)
    : 0
  const started = product.baselineStart
  const estimate = Math.max(1, Number(product.estDays) || 7)
  const elapsedWorkdays = started
    ? workdaysBetween(started, today) +
      (started <= today && isWorkday(new Date(`${started}T00:00:00`)) ? 1 : 0)
    : 0
  const planned =
    product.status === "In progress" && started
      ? Math.min(100, Math.round((elapsedWorkdays / estimate) * 100))
      : coverage
  const behind =
    product.status === "In progress" ? Math.max(0, planned - coverage) : 0
  const endDate = started ? addWorkdays(started, estimate) : ""
  const overdueCycle = cycleRows(product).some(
    (row) => row.next && row.next < today && !row.eventBased
  )
  const missedBaseline =
    product.status === "In progress" &&
    endDate < today &&
    coverage < CLOSEOUT_COVERAGE
  const missedStart =
    product.status === "Not started" && !!started && started < today
  const missedResume =
    product.status === "Paused" &&
    !!product.resumeOn &&
    product.resumeOn < today
  const stalled =
    product.status === "In progress" &&
    !!product.lastTested &&
    workdaysBetween(product.lastTested, today) >= 3

  let health: Health = "Green"
  if (
    overdueCritical ||
    behind > 20 ||
    overdueCycle ||
    missedBaseline ||
    missedStart ||
    missedResume
  )
    health = "Red"
  else if (
    overdueHigh ||
    overdueRetest ||
    behind > 0 ||
    product.status === "Paused" ||
    stalled
  )
    health = "Amber"
  if (product.status === "Not started" && !missedStart) health = "Not started"
  else if (product.status === "Paused" && health !== "Red") health = "Paused"

  return {
    areas: areas.length,
    counts,
    tested,
    highRisk: highRisk.length,
    priorityTested,
    coverage,
    priorityCoverage,
    findings: productFindings,
    open,
    count,
    risk,
    health,
    overdueCritical,
    overdueHigh,
    overdueRetest,
    planned,
    behind,
    elapsedWorkdays,
    endDate,
    overdueCycle,
    stalled,
    missedStart,
    missedResume,
  }
}

export type ProductMetrics = ReturnType<typeof metricsFor>

const REQUIRED_FINDING_FIELDS = [
  "title",
  "description",
  "steps",
  "impact",
  "evidence",
  "severity",
  "cvss",
  "recommendation",
  "reference",
  "affectedFeature",
  "foundWhile",
  "environment",
  "relatedTask",
] as const

export function isFindingComplete(finding: Finding) {
  const has = (value: unknown) => String(value ?? "").trim().length > 0
  return (
    REQUIRED_FINDING_FIELDS.every((field) => has(finding[field])) &&
    (!finding.late ||
      [finding.previousTest, finding.discoveryMethod, finding.lateCause].every(
        has
      )) &&
    (!EXIT_STATUSES.includes(finding.status) || has(finding.statusReason))
  )
}

/** SOP baseline close-out: 100% priority, ≥80% overall, complete tickets, reasons for untested areas. */
export function meetsCloseoutCriteria(
  product: Product,
  metrics: ProductMetrics
) {
  const untestedHaveReasons = (product.areas || []).every(
    (area) =>
      area.s === "Tested" || String(area.reason || area.notes || "").trim()
  )
  return (
    metrics.priorityCoverage === 100 &&
    metrics.coverage >= CLOSEOUT_COVERAGE &&
    untestedHaveReasons &&
    metrics.findings.every(isFindingComplete)
  )
}

export function nextFindingId(findings: Finding[], project = "SEC") {
  const prefix = `${project}-`
  const greatest = findings.reduce((max, finding) => {
    if (!finding.id?.startsWith(prefix)) return max
    const number = Number(finding.id.slice(prefix.length))
    return Number.isFinite(number) ? Math.max(max, number) : max
  }, 0)
  return `${prefix}${greatest + 1}`
}

export function coverageSnapshot(
  products: [string, ProductRecord][],
  date = todayIso()
): CoverageSnapshot {
  const cov: Record<string, number> = {}
  products.forEach(([id, product]) => {
    const areas = product.areas || []
    if (areas.length)
      cov[id] = Math.round(
        (areas.filter((a) => a.s === "Tested").length / areas.length) * 100
      )
  })
  return { date, cov }
}
