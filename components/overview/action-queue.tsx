import Link from "next/link"
import { ArrowRightIcon, CheckCircle2Icon } from "lucide-react"

import { SeverityBadge, SeverityDot, ToneBadge } from "@/components/status"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { dateDiff, formatDate, todayIso } from "@/lib/dates"
import { isClosed, retestDueFor } from "@/lib/metrics"
import { SEVERITIES } from "@/lib/sop"
import type { DashboardData, Finding } from "@/lib/types"
import { cn } from "@/lib/utils"

function dueLabel(due: string | undefined) {
  if (!due) return { text: "No deadline", late: false }
  const days = dateDiff(todayIso(), due)
  if (days < 0) return { text: `${-days}d overdue`, late: true }
  if (days === 0) return { text: "Due today", late: true }
  return { text: `Due in ${days}d`, late: false }
}

export function ActionQueue({
  data,
  findings,
}: {
  data: DashboardData
  findings: Finding[]
}) {
  const retests = findings
    .filter((f) => f.status === "Ready for Retest")
    .map((f) => ({ finding: f, kind: "retest" as const, due: retestDueFor(f) }))
  const urgent = findings
    .filter(
      (f) =>
        !isClosed(f) &&
        f.status !== "Ready for Retest" &&
        ["Critical", "High"].includes(f.severity)
    )
    .map((f) => ({ finding: f, kind: "fix" as const, due: f.due }))
  const items = [...retests, ...urgent]
    .sort(
      (a, b) =>
        SEVERITIES.indexOf(a.finding.severity) -
          SEVERITIES.indexOf(b.finding.severity) ||
        (a.due || "9999").localeCompare(b.due || "9999")
    )
    .slice(0, 6)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Needs action</CardTitle>
        <CardDescription>
          Open Critical/High findings and fixes waiting for retest
        </CardDescription>
        <CardAction>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard/findings">
              All findings <ArrowRightIcon data-icon="inline-end" />
            </Link>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="px-3">
        {items.length ? (
          <ul className="grid gap-0.5">
            {items.map(({ finding, kind, due }) => {
              const label = dueLabel(due)
              return (
                <li key={finding.id}>
                  <Link
                    href={`/dashboard/products/${finding.product}`}
                    className="flex items-center gap-3 rounded-3xl px-3 py-2.5 transition-colors outline-none hover:bg-muted/70 focus-visible:ring-3 focus-visible:ring-ring/30"
                  >
                    <SeverityDot severity={finding.severity} />
                    <span className="grid min-w-0 flex-1 gap-0.5">
                      <span className="truncate text-sm font-medium">
                        {finding.title}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        <span className="font-mono">{finding.id}</span> ·{" "}
                        {data.products[finding.product]?.name ??
                          finding.product}{" "}
                        ·{" "}
                        {kind === "retest"
                          ? `Ready ${formatDate(finding.readyDate)}`
                          : finding.status}
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-1">
                      {kind === "retest" ? (
                        <ToneBadge tone="paused">Retest</ToneBadge>
                      ) : (
                        <SeverityBadge severity={finding.severity} />
                      )}
                      <span
                        className={cn(
                          "text-xs tabular",
                          label.late
                            ? "font-medium text-critical"
                            : "text-muted-foreground"
                        )}
                      >
                        {label.text}
                      </span>
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        ) : (
          <div className="flex items-center gap-3 rounded-3xl bg-success/10 px-4 py-5 text-sm">
            <CheckCircle2Icon className="size-5 text-success" />
            <span>
              Nothing urgent. No open Critical/High findings and no retests
              waiting.
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
