import { cn } from "@/lib/utils"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { AreaCounts } from "@/lib/metrics"
import { CLOSEOUT_COVERAGE } from "@/lib/sop"

const SEGMENTS = [
  { key: "Tested", label: "Tested", className: "bg-primary" },
  { key: "In Testing", label: "In testing", className: "bg-primary/35" },
  { key: "Blocked", label: "Blocked", className: "bg-critical/70" },
] as const

/**
 * Sentinel's signature: a segmented coverage pill (tested / in testing / blocked / to do)
 * with a tick at the SOP's 80% baseline close-out line.
 */
export function CloseoutMeter({
  counts,
  size = "default",
  className,
}: {
  counts: AreaCounts
  size?: "sm" | "default" | "lg"
  className?: string
}) {
  const total =
    counts.Tested + counts["In Testing"] + counts.Blocked + counts["To Do"]
  const coverage = total ? Math.round((counts.Tested / total) * 100) : 0
  const passed = coverage >= CLOSEOUT_COVERAGE

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          role="meter"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={coverage}
          aria-label={`Coverage ${coverage}% (${counts.Tested} of ${total} areas tested); close-out line ${CLOSEOUT_COVERAGE}%`}
          tabIndex={0}
          className={cn(
            "relative flex w-full rounded-full bg-muted outline-none focus-visible:ring-3 focus-visible:ring-ring/30",
            size === "sm" && "h-1.5",
            size === "default" && "h-2",
            size === "lg" && "h-3",
            className
          )}
        >
          <div className="flex w-full animate-reveal-x gap-px overflow-hidden rounded-full">
            {SEGMENTS.map(({ key, className: tone }) =>
              counts[key] ? (
                <span
                  key={key}
                  className={cn(
                    "h-full transition-[width] duration-300 ease-out",
                    tone
                  )}
                  style={{ width: `${(counts[key] / total) * 100}%` }}
                />
              ) : null
            )}
          </div>
          <span
            aria-hidden
            className={cn(
              "absolute -inset-y-1 w-0.5 rounded-full ring-2 ring-card",
              passed ? "bg-success" : "bg-foreground/55"
            )}
            style={{ left: `${CLOSEOUT_COVERAGE}%` }}
          />
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="tabular">
        <div className="grid gap-1">
          <span className="font-medium">
            {coverage}% tested · close-out at {CLOSEOUT_COVERAGE}%
          </span>
          <span className="opacity-80">
            {counts.Tested} tested · {counts["In Testing"]} in testing ·{" "}
            {counts.Blocked} blocked · {counts["To Do"]} to do
          </span>
        </div>
      </TooltipContent>
    </Tooltip>
  )
}

export function MeterLegend({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground",
        className
      )}
    >
      {SEGMENTS.map(({ key, label, className: tone }) => (
        <span key={key} className="inline-flex items-center gap-1.5">
          <span aria-hidden className={cn("size-2 rounded-full", tone)} />
          {label}
        </span>
      ))}
      <span className="inline-flex items-center gap-1.5">
        <span
          aria-hidden
          className="size-2 rounded-full bg-muted ring-1 ring-border"
        />
        To do
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span aria-hidden className="h-3 w-0.5 rounded-full bg-foreground/55" />
        {CLOSEOUT_COVERAGE}% close-out line
      </span>
    </div>
  )
}
