"use client"

import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts"

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { formatDate } from "@/lib/dates"

const coverageConfig = {
  value: { label: "Avg. coverage", color: "var(--chart-1)" },
} satisfies ChartConfig

/** The coverage area chart; split out so Recharts loads lazily. */
export function CoveragePlot({
  points,
}: {
  points: { date: string; value: number | null }[]
}) {
  return (
    <ChartContainer
      config={coverageConfig}
      className="aspect-auto h-64 w-full animate-reveal-chart"
    >
      <AreaChart data={points} margin={{ left: -16, right: 8, top: 8 }}>
        <defs>
          <linearGradient id="coverage-fill" x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="0%"
              stopColor="var(--color-value)"
              stopOpacity={0.28}
            />
            <stop
              offset="100%"
              stopColor="var(--color-value)"
              stopOpacity={0.02}
            />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} strokeDasharray="3 4" />
        <XAxis
          dataKey="date"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          tickFormatter={(v: string) => formatDate(v)}
        />
        <YAxis
          domain={[0, 100]}
          ticks={[0, 25, 50, 80, 100]}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: number) => `${v}%`}
        />
        <ReferenceLine
          y={80}
          stroke="var(--muted-foreground)"
          strokeDasharray="4 4"
          label={{
            value: "Close-out 80%",
            position: "insideTopRight",
            fill: "var(--muted-foreground)",
            fontSize: 11,
          }}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              labelFormatter={(value) =>
                formatDate(String(value), {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })
              }
              formatter={(value) => (
                <span className="flex w-full justify-between gap-4">
                  <span className="text-muted-foreground">Avg. coverage</span>
                  <span className="font-medium tabular">{value}%</span>
                </span>
              )}
            />
          }
        />
        <Area
          isAnimationActive={false}
          dataKey="value"
          type="monotone"
          stroke="var(--color-value)"
          strokeWidth={2.5}
          fill="url(#coverage-fill)"
          dot={{ r: 3.5, fill: "var(--card)", strokeWidth: 2 }}
          activeDot={{ r: 5 }}
        />
      </AreaChart>
    </ChartContainer>
  )
}
