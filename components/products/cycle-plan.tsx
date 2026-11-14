"use client"

import {
  CalendarCheckIcon,
  PackageSearchIcon,
  RefreshCwIcon,
  RocketIcon,
  type LucideIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { formatDate, LONG_DATE, todayIso } from "@/lib/dates"
import { cycleRows } from "@/lib/metrics"
import { useDashboard } from "@/lib/store"
import type { Product } from "@/lib/types"
import { cn } from "@/lib/utils"

const ICONS: Record<string, LucideIcon> = {
  baseline: CalendarCheckIcon,
  release: RocketIcon,
  dep: PackageSearchIcon,
}

export function CyclePlan({ product }: { product: Product }) {
  const { actions } = useDashboard()
  const today = todayIso()

  return (
    <div className="grid gap-4">
      <ul className="grid gap-2">
        {cycleRows(product).map((row) => {
          const Icon = ICONS[row.key] ?? RefreshCwIcon
          const overdue = !!row.next && row.next < today
          const value =
            product.done?.[row.source] ||
            (row.source === "baseline" ? product.closeout || "" : "")
          return (
            <li
              key={row.key}
              className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-3xl bg-muted/50 px-4 py-3"
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-background text-primary shadow-xs">
                <Icon className="size-4" />
              </span>
              <span className="grid min-w-44 flex-1 gap-0.5">
                <span className="text-sm font-medium">{row.title}</span>
                <span className="text-xs text-muted-foreground">
                  {row.frequency} ·{" "}
                  {row.last
                    ? `last ${formatDate(row.last)}`
                    : "no date recorded"}
                </span>
              </span>
              <span
                className={cn(
                  "min-w-28 text-sm tabular",
                  overdue
                    ? "font-medium text-critical"
                    : "text-muted-foreground"
                )}
              >
                {row.eventBased
                  ? "Release based"
                  : row.next
                    ? `Due ${formatDate(row.next, LONG_DATE)}`
                    : "Not scheduled"}
              </span>
              <span className="flex items-center gap-2">
                <Input
                  type="date"
                  aria-label={`${row.eventBased ? "Last review" : "Last done"}: ${row.title}`}
                  className="h-8 w-38 bg-background"
                  value={value}
                  onChange={(e) =>
                    actions.updateCycleDate(
                      product.id,
                      row.source,
                      e.target.value
                    )
                  }
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    actions.updateCycleDate(product.id, row.source, today)
                  }
                >
                  {row.eventBased ? "Mark reviewed" : "Mark done"}
                </Button>
              </span>
            </li>
          )
        })}
      </ul>
      <p className="px-1 text-xs text-muted-foreground">
        Tier {product.tier} intervals run from each activity’s last-completed
        date, using the SOP starter targets.
      </p>
    </div>
  )
}
