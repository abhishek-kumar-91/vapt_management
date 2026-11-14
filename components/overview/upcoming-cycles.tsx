import Link from "next/link"
import { CalendarClockIcon } from "lucide-react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { dateDiff, formatDate, todayIso } from "@/lib/dates"
import { cycleRows } from "@/lib/metrics"
import type { Product } from "@/lib/types"
import { cn } from "@/lib/utils"

export function UpcomingCycles({ products }: { products: Product[] }) {
  const today = todayIso()
  const upcoming = products
    .flatMap((product) =>
      cycleRows(product)
        .filter((row) => row.next)
        .map((row) => ({ ...row, product }))
    )
    .sort((a, b) => a.next.localeCompare(b.next))
    .slice(0, 5)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Next test cycles</CardTitle>
        <CardDescription>Tier-based SOP schedule</CardDescription>
      </CardHeader>
      <CardContent className="px-3">
        {upcoming.length ? (
          <ul className="grid gap-0.5">
            {upcoming.map((row) => {
              const days = dateDiff(today, row.next)
              return (
                <li key={`${row.product.id}-${row.key}`}>
                  <Link
                    href={`/dashboard/products/${row.product.id}`}
                    className="flex items-center gap-3 rounded-3xl px-3 py-2 transition-colors outline-none hover:bg-muted/70 focus-visible:ring-3 focus-visible:ring-ring/30"
                  >
                    <span
                      className={cn(
                        "grid size-11 shrink-0 place-content-center rounded-2xl text-center leading-none",
                        days < 0
                          ? "bg-critical/12 text-critical"
                          : "bg-primary/10 text-primary"
                      )}
                    >
                      <span className="text-base font-semibold tabular">
                        {formatDate(row.next, { day: "numeric" })}
                      </span>
                      <span className="text-xs font-medium">
                        {formatDate(row.next, { month: "short" })}
                      </span>
                    </span>
                    <span className="grid min-w-0 flex-1 gap-0.5">
                      <span className="truncate text-sm font-medium">
                        {row.title}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        {row.product.name} · {row.frequency}
                      </span>
                    </span>
                    <span
                      className={cn(
                        "shrink-0 text-xs tabular",
                        days < 0
                          ? "font-medium text-critical"
                          : "text-muted-foreground"
                      )}
                    >
                      {days < 0
                        ? `${-days}d overdue`
                        : days === 0
                          ? "Today"
                          : `in ${days}d`}
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        ) : (
          <div className="flex items-center gap-3 rounded-3xl bg-muted px-4 py-5 text-sm text-muted-foreground">
            <CalendarClockIcon className="size-5" />
            Record a last-done date on a product to schedule its cycles.
          </div>
        )}
      </CardContent>
    </Card>
  )
}
