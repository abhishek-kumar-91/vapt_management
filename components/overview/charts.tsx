"use client"

import dynamic from "next/dynamic"
import { TrendingUpIcon } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { SEVERITY_DOT } from "@/components/status"
import { metricsFor } from "@/lib/metrics"
import { SEVERITIES } from "@/lib/sop"
import type { CoverageSnapshot, Finding, Product } from "@/lib/types"
import { cn } from "@/lib/utils"

export function FindingsChart({
  products,
  findings,
}: {
  products: Product[]
  findings: Finding[]
}) {
  const rows = products.map((product) => {
    const m = metricsFor(product, findings)
    return {
      id: product.id,
      name: product.name,
      count: m.count,
      total: m.open.length,
    }
  })
  const max = Math.max(1, ...rows.map((row) => row.total))

  return (
    <Card>
      <CardHeader>
        <CardTitle>Open vulnerabilities</CardTitle>
        <CardDescription>Open findings by product and severity</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5">
        {rows.length ? (
          <ul className="grid gap-3.5">
            {rows.map((row) => (
              <li
                key={row.id}
                className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)_2rem] items-center gap-3 text-sm"
              >
                <span
                  className="truncate text-muted-foreground"
                  title={row.name}
                >
                  {row.name}
                </span>
                <span
                  className="flex h-3 overflow-hidden rounded-full bg-muted"
                  role="img"
                  aria-label={`${row.name}: ${SEVERITIES.map((s) => `${row.count[s]} ${s}`).join(", ")}`}
                >
                  <span
                    className="flex h-full animate-reveal-x gap-px overflow-hidden rounded-full"
                    style={{ width: `${(row.total / max) * 100}%` }}
                  >
                    {SEVERITIES.map((s) =>
                      row.count[s] ? (
                        <span
                          key={s}
                          title={`${s}: ${row.count[s]}`}
                          className={cn("h-full", SEVERITY_DOT[s])}
                          style={{
                            width: `${(row.count[s] / row.total) * 100}%`,
                          }}
                        />
                      ) : null
                    )}
                  </span>
                </span>
                <span className="text-right font-medium tabular">
                  {row.total}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-10 text-center text-sm text-muted-foreground">
            No products match these filters.
          </p>
        )}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {SEVERITIES.map((s) => (
            <span key={s} className="inline-flex items-center gap-1.5">
              <span
                aria-hidden
                className={cn("size-2 rounded-full", SEVERITY_DOT[s])}
              />
              {s}
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// Recharts is ~85KB gzipped and only this plot uses it: load it after the
// page renders, into a box of the same height so nothing shifts.
const CoveragePlot = dynamic(
  () =>
    import("@/components/overview/coverage-plot").then((m) => m.CoveragePlot),
  { ssr: false, loading: () => <div aria-hidden className="h-64 w-full" /> }
)

export function CoverageChart({
  products,
  history,
}: {
  products: Product[]
  history: CoverageSnapshot[]
}) {
  const points = history
    .slice(-8)
    .map((snapshot) => {
      const values = products
        .map((p) => snapshot.cov?.[p.id])
        .filter((v): v is number => Number.isFinite(v))
      return {
        date: snapshot.date,
        value: values.length
          ? Math.round(values.reduce((sum, v) => sum + v, 0) / values.length)
          : null,
      }
    })
    .filter((point) => point.value !== null)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Testing progress</CardTitle>
        <CardDescription>
          Average coverage from weekly snapshots
        </CardDescription>
      </CardHeader>
      <CardContent>
        {points.length >= 2 ? (
          <CoveragePlot points={points} />
        ) : (
          <div className="grid h-64 place-content-center justify-items-center gap-2 text-center text-sm text-muted-foreground">
            <span className="grid size-10 place-items-center rounded-full bg-primary/10 text-primary">
              <TrendingUpIcon className="size-5" />
            </span>
            <p className="max-w-56">
              Coverage trends appear once at least two weekly snapshots exist.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
