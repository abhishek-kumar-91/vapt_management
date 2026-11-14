import Link from "next/link"
import {
  AlertTriangleIcon,
  BanIcon,
  FileTextIcon,
  FlagIcon,
  type LucideIcon,
  RefreshCwIcon,
  ShieldAlertIcon,
  SirenIcon,
  TrendingUpIcon,
  ArrowLeftRightIcon,
  UserCogIcon,
} from "lucide-react"

import { formatDate, LONG_DATE } from "@/lib/dates"
import type { ActivityEvent } from "@/lib/types"
import { cn } from "@/lib/utils"

const EVENT_STYLE: Record<string, { icon: LucideIcon; tone: string }> = {
  Progress: { icon: TrendingUpIcon, tone: "bg-primary/10 text-primary" },
  Finding: {
    icon: ShieldAlertIcon,
    tone: "bg-high/15 text-[color-mix(in_oklch,var(--high),black_20%)] dark:text-high",
  },
  Escalation: { icon: AlertTriangleIcon, tone: "bg-critical/12 text-critical" },
  Incident: { icon: SirenIcon, tone: "bg-critical/12 text-critical" },
  Retest: { icon: RefreshCwIcon, tone: "bg-paused/12 text-paused" },
  Report: { icon: FileTextIcon, tone: "bg-muted text-muted-foreground" },
  Switch: {
    icon: ArrowLeftRightIcon,
    tone: "bg-warning/18 text-[color-mix(in_oklch,var(--warning),black_42%)] dark:text-warning",
  },
  "Close-out": { icon: FlagIcon, tone: "bg-success/12 text-success" },
  Blocker: { icon: BanIcon, tone: "bg-critical/12 text-critical" },
  Access: { icon: UserCogIcon, tone: "bg-primary/10 text-primary" },
}

export function ActivityFeed({
  events,
  productNames,
  showProduct = true,
  longDates = false,
}: {
  events: ActivityEvent[]
  productNames?: Record<string, string>
  showProduct?: boolean
  longDates?: boolean
}) {
  if (!events.length) {
    return (
      <p className="px-3 py-8 text-center text-sm text-muted-foreground">
        No activity recorded yet.
      </p>
    )
  }
  return (
    <ol className="grid">
      {events.map((event, index) => {
        const style = EVENT_STYLE[event.type] ?? EVENT_STYLE.Report
        const Icon = style.icon
        const last = index === events.length - 1
        return (
          <li
            key={`${event.date}-${index}`}
            className="relative flex gap-3 pb-5 last:pb-0"
          >
            {!last && (
              <span
                aria-hidden
                className="absolute top-9 bottom-1 left-[15px] w-px bg-border"
              />
            )}
            <span
              className={cn(
                "grid size-8 shrink-0 place-items-center rounded-full",
                style.tone
              )}
            >
              <Icon className="size-4" />
            </span>
            <div className="grid min-w-0 flex-1 gap-0.5 pt-0.5">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-sm font-medium">{event.type}</span>
                {showProduct &&
                  event.product &&
                  productNames?.[event.product] && (
                    <Link
                      href={`/dashboard/products/${event.product}`}
                      className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                    >
                      {productNames[event.product]}
                    </Link>
                  )}
                <time
                  dateTime={event.date}
                  className="ml-auto text-xs text-muted-foreground tabular"
                >
                  {formatDate(event.date, longDates ? LONG_DATE : undefined)}
                </time>
              </div>
              <p className="text-sm text-pretty wrap-anywhere text-muted-foreground">
                {event.text}
              </p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
