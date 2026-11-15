import { CloseoutMeter, MeterLegend } from "@/components/closeout-meter"
import { SeverityCounts } from "@/components/status"
import { Card, CardContent } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { areaCounts, metricsFor, retestDueFor } from "@/lib/metrics"
import { SEVERITIES } from "@/lib/sop"
import { todayIso } from "@/lib/dates"
import type { Finding, Product, Severity } from "@/lib/types"

function Stat({
  label,
  value,
  children,
}: {
  label: string
  value: React.ReactNode
  children?: React.ReactNode
}) {
  return (
    <div className="grid content-start gap-1.5">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-3xl font-semibold tracking-tight tabular">
        {value}
      </span>
      {children && (
        <div className="text-xs text-muted-foreground">{children}</div>
      )}
    </div>
  )
}

export function PortfolioSummary({
  products,
  findings,
}: {
  products: Product[]
  findings: Finding[]
}) {
  const ids = new Set(products.map((p) => p.id))
  const scoped = findings.filter((f) => ids.has(f.product))
  const counts = areaCounts(products.flatMap((p) => p.areas || []))
  const total =
    counts.Tested + counts["In Testing"] + counts.Blocked + counts["To Do"]
  const coverage = total ? Math.round((counts.Tested / total) * 100) : 0
  const metrics = products.map((p) => metricsFor(p, findings))
  const open = metrics.flatMap((m) => m.open)
  const bySeverity = Object.fromEntries(
    SEVERITIES.map((s) => [s, open.filter((f) => f.severity === s).length])
  )
  const retests = scoped.filter((f) => f.status === "Ready for Retest")
  const overdueRetests = retests.filter((f) => {
    const due = retestDueFor(f)
    return !!due && due < todayIso()
  }).length
  const red = metrics.filter((m) => m.health === "Red").length

  return (
    <Card>
      <CardContent className="grid gap-8 lg:grid-cols-[minmax(0,1.35fr)_auto_minmax(0,1fr)]">
        <div className="grid content-start gap-4">
          <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
            <Stat label="Portfolio test coverage" value={`${coverage}%`} />
            <p className="pb-1 text-sm text-muted-foreground tabular">
              <span className="font-medium text-foreground">
                {counts.Tested}
              </span>{" "}
              of {total} test areas tested
              {counts.Blocked > 0 && <> · {counts.Blocked} blocked</>}
            </p>
          </div>
          <CloseoutMeter counts={counts} size="lg" />
          <MeterLegend />
        </div>

        <Separator orientation="vertical" className="hidden lg:block" />

        <div className="grid grid-cols-3 gap-4">
          <Stat label="Open findings" value={open.length}>
            <SeverityCounts
              count={bySeverity as Record<Severity, number>}
              className="grid w-fit grid-cols-2 gap-y-0.5"
            />
          </Stat>
          <Stat label="Retests waiting" value={retests.length}>
            {overdueRetests ? (
              <span className="font-medium text-critical">
                {overdueRetests} past 2-day target
              </span>
            ) : (
              "All within 2-day target"
            )}
          </Stat>
          <Stat label="Products in Red" value={red}>
            of {products.length} monitored
          </Stat>
        </div>
      </CardContent>
    </Card>
  )
}
