import {
  addDays,
  dateDiff,
  formatDate,
  LONG_DATE,
  todayIso,
  workdaysBetween,
} from "./dates"
import { cycleRows, isClosed, isFindingComplete, metricsFor } from "./metrics"
import { SEVERITIES } from "./sop"
import type {
  DashboardData,
  Finding,
  Product,
  ProductRecord,
  ReportType,
} from "./types"

export const REPORT_TYPES: {
  value: ReportType
  label: string
  title: string
  archiveTitle: string
}[] = [
  {
    value: "daily",
    label: "Daily update",
    title: "Daily testing update",
    archiveTitle: "Daily update",
  },
  {
    value: "weekly",
    label: "Weekly report",
    title: "Weekly security report",
    archiveTitle: "Weekly report",
  },
  {
    value: "monthly",
    label: "Monthly review",
    title: "Monthly security review",
    archiveTitle: "Monthly review",
  },
  {
    value: "closeout",
    label: "Baseline close-out",
    title: "Baseline close-out report",
    archiveTitle: "Close-out report",
  },
]

export interface ReportForm {
  date: string
  productId: string
  tested: string
  methods: string
  findingNotes: string
  blocked: string
  tomorrow: string
  lessons: string
  resources: string
  manager: string
}

export function buildFindingReport(
  finding: Finding,
  product: ProductRecord | undefined
) {
  const deadline =
    finding.due ||
    (finding.severity === "Low"
      ? `Next release${finding.targetRelease ? ` (${finding.targetRelease})` : ""}`
      : "Not set")
  const nr = "Not recorded"
  return [
    `# [${product?.name ?? finding.product}][${finding.affectedFeature || "Feature"}][${finding.severity}] ${finding.title}`,
    "",
    `Ticket: ${finding.id}`,
    `Status: ${finding.status}`,
    `CVSS vector: ${finding.cvss || nr}`,
    `CWE / OWASP: ${finding.reference || nr}`,
    `Affected feature: ${finding.affectedFeature || nr}`,
    `Linked test task: ${finding.relatedTask || nr}`,
    `Found while testing: ${finding.foundWhile || nr}`,
    `Environment: ${finding.environment || nr}`,
    `Validated: ${finding.validatedAt || finding.found || nr}`,
    `Fix deadline: ${deadline}`,
    `Retest date: ${finding.retestCompleted || finding.retestDate || nr}`,
    "",
    "## Description",
    finding.description || nr,
    "",
    "## Steps to reproduce",
    finding.steps || nr,
    "",
    "## Impact",
    finding.impact || nr,
    "",
    "## Redacted evidence",
    finding.evidence || nr,
    "",
    "## Recommendation",
    finding.recommendation || nr,
    "",
    `Exit / status reason: ${finding.statusReason || "Not applicable"}`,
    `Late finding: ${
      finding.late
        ? `Yes — cause ${finding.lateCause || "not recorded"}; previously tested ${finding.previousTest || "date not recorded"}; discovered by ${finding.discoveryMethod || "method not recorded"}`
        : "No"
    }`,
    "",
    "Confidential — internal use only. Evidence must not contain credentials or customer data.",
  ].join("\n")
}

export function buildReport(
  data: DashboardData,
  type: ReportType,
  form: ReportForm,
  products: Product[],
  findings: Finding[]
) {
  const date = form.date || todayIso()
  const reportTitle = REPORT_TYPES.find((item) => item.value === type)!.title
  const start =
    type === "weekly"
      ? addDays(date, -6)
      : type === "monthly"
        ? `${date.slice(0, 7)}-01`
        : date
  const matchingEvents = data.events.filter(
    (event) => event.date >= start && event.date <= date
  )
  const lines = [
    `# ${reportTitle}`,
    `Date: ${formatDate(date, { day: "numeric", month: "long", year: "numeric" })}`,
    "Owner: Security Tester",
    "",
  ]
  if (type === "daily") {
    const product = products.find((item) => item.id === form.productId)
    const m = product ? metricsFor(product, findings) : null
    lines.push(
      `Target: ${product?.name || "Portfolio"}`,
      `Tested: ${form.tested || "None recorded"}${m ? ` (${m.tested}/${m.areas} checklist areas currently tested)` : ""}`,
      `Methods: ${form.methods || "Not recorded"}`,
      `Found: ${findings.filter((finding) => finding.found === date).length} finding(s) validated today`,
      `Notes: ${form.findingNotes || "No additional finding notes"}`,
      `Blocked: ${form.blocked || "None reported"}`,
      `Tomorrow: ${form.tomorrow || "Not recorded"}`,
      "",
      "No finding means no issue was identified with the listed methods on this date; it is not proof of security."
    )
  } else {
    const includedProducts =
      type === "closeout" && form.productId
        ? products.filter((p) => p.id === form.productId)
        : products
    const inPeriod = findings.filter((f) => f.found >= start && f.found <= date)
    const resolved = findings.filter(
      (f) => !!f.closed && f.closed >= start && f.closed <= date
    )
    const rejected = findings.filter((f) => f.status === "Rejected")
    const completeTickets = findings.filter(isFindingComplete).length
    const retested = findings.filter(
      (f) => f.readyDate && f.closed && f.retestCompleted
    )
    const reported = findings.filter((f) => f.validatedAt && f.reportedAt)
    const averageRetestDays = retested.length
      ? (
          retested.reduce(
            (sum, f) => sum + workdaysBetween(f.readyDate, f.retestCompleted),
            0
          ) / retested.length
        ).toFixed(1)
      : "No completed retests recorded"
    const averageReportHours = reported.length
      ? (
          reported.reduce(
            (sum, f) =>
              sum +
              Math.max(
                0,
                (new Date(f.reportedAt!).getTime() -
                  new Date(f.validatedAt!).getTime()) /
                  3600000
              ),
            0
          ) / reported.length
        ).toFixed(1)
      : "No validation timestamps recorded"
    const highCritical = findings.filter(
      (f) => ["Critical", "High"].includes(f.severity) && !isClosed(f)
    )
    lines.push(
      `Reporting period: ${formatDate(start, LONG_DATE)} – ${formatDate(date, LONG_DATE)}`,
      "",
      "## Portfolio coverage and plan"
    )
    includedProducts.forEach((product) => {
      const m = metricsFor(product, findings)
      const nextDue =
        cycleRows(product)
          .filter((row) => row.next)
          .map((row) => row.next)
          .sort()[0] || "not scheduled"
      lines.push(
        `- ${product.name} | Tier ${product.tier} | ${product.status} | Coverage ${m.coverage}% (${m.tested}/${m.areas}) | Priority ${m.priorityCoverage}% | Plan ${m.planned}% / actual ${m.coverage}% (${m.behind}% behind) | Open C/H/M/L ${m.count.Critical}/${m.count.High}/${m.count.Medium}/${m.count.Low} | Health ${m.health} | Last tested ${product.lastTested || "not recorded"} | Next due ${nextDue}`
      )
    })
    lines.push(
      "",
      "## Metrics",
      `Validated findings by severity: ${SEVERITIES.map((s) => `${s} ${inPeriod.filter((f) => f.severity === s).length}`).join(" | ")}`,
      `Findings opened this period: ${inPeriod.length}`,
      `Findings closed this period: ${resolved.length}`,
      `Open Critical/High findings: ${highCritical.length}`,
      `False positive rate (Rejected / total findings): ${findings.length ? `${((rejected.length / findings.length) * 100).toFixed(1)}%` : "0%"}`,
      `Ticket completeness: ${findings.length ? `${Math.round((completeTickets / findings.length) * 100)}% (${completeTickets}/${findings.length})` : "N/A (no findings)"}`,
      `Average time to report after validation: ${averageReportHours}`,
      `Average retest turnaround: ${averageRetestDays} working days`,
      `Retests waiting: ${findings.filter((f) => f.status === "Ready for Retest").length}`,
      `Late findings: ${findings.filter((f) => f.late && f.found >= start && f.found <= date).length}`
    )
    if (type === "monthly") {
      lines.push("", "## Open Critical/High ageing")
      highCritical.forEach((f) =>
        lines.push(
          `- ${f.id} ${f.severity}: ${f.title} — ${dateDiff(f.found, date)} calendar days open`
        )
      )
      lines.push("", "## Product register")
      includedProducts.forEach((p) =>
        lines.push(
          `- ${p.name}: Tier ${p.tier}; owner ${p.owner || "not recorded"}; data sensitivity ${p.dataSensitivity || "not recorded"}; technology ${p.technology || "not recorded"}; last tested ${p.lastTested || "not recorded"}`
        )
      )
      lines.push(
        "",
        `## Review notes and lessons\n${form.lessons || "Not recorded"}`,
        `Resource needs: ${form.resources || "None recorded"}`
      )
    }
    if (type === "closeout") {
      const product = includedProducts[0]
      if (product) {
        const m = metricsFor(product, findings)
        const untested = (product.areas || []).filter(
          (area) => area.s !== "Tested"
        )
        lines.push(
          "",
          `## Close-out: ${product.name}`,
          `Coverage: ${m.coverage}%`,
          `Priority coverage: ${m.priorityCoverage}%`,
          `Close-out criterion (priority 100%, overall ≥80%, report issued): ${m.priorityCoverage === 100 && m.coverage >= 80 ? "Coverage targets met; record report date in product register." : "Not met — list remaining scope and seek Manager decision."}`,
          "Untested areas:"
        )
        untested.forEach((area) =>
          lines.push(
            `- ${area.n} [${area.s}] ${area.reason || "Reason not recorded"}`
          )
        )
        if (!untested.length) lines.push("- None")
        lines.push(`Recommendations: ${form.lessons || "Not recorded"}`)
      }
    }
    lines.push("", "## Target switches, blockers and next plan")
    matchingEvents
      .filter((e) => e.type === "Switch")
      .forEach((e) => lines.push(`- ${e.date}: ${e.text}`))
    lines.push(
      `Blockers: ${form.blocked || "See activity log; none additionally reported"}`,
      `Next period plan: ${form.tomorrow || "Not recorded"}`,
      `Manager requests: ${form.manager || "None recorded"}`
    )
    lines.push("", "## Activity")
    matchingEvents.forEach((e) =>
      lines.push(`- ${e.date} · ${e.type}: ${e.text}`)
    )
  }
  lines.push(
    "",
    "Confidential — internal use only. Never include credentials, customer data or unredacted evidence."
  )
  return lines.join("\n")
}

export function retestMailto(
  email: string | undefined,
  finding: Finding,
  productName: string,
  readyDate: string
) {
  const body = `Retest requested for ${finding.id}\nProduct: ${productName}\nFinding: ${finding.title}\nSeverity: ${finding.severity}\nFix ready: ${readyDate}\nPlease verify the fix and record the retest outcome.`
  return `mailto:${encodeURIComponent(email || "")}?subject=${encodeURIComponent(`Retest requested: ${finding.id} (${finding.severity})`)}&body=${encodeURIComponent(body)}`
}

export function downloadText(
  body: string,
  name: string,
  type = "text/markdown;charset=utf-8"
) {
  const url = URL.createObjectURL(new Blob([body], { type }))
  const link = document.createElement("a")
  link.href = url
  link.download = name
  link.click()
  URL.revokeObjectURL(url)
}
