import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import type { FindingStatus, Health, Severity } from "@/lib/types"

/** Text + tinted background per semantic tone; colour is always paired with a word. */
const TONE = {
  critical:
    "bg-critical/12 text-critical dark:bg-critical/20 dark:text-[color-mix(in_oklch,var(--critical),white_22%)]",
  high: "bg-high/14 text-[color-mix(in_oklch,var(--high),black_22%)] dark:bg-high/20 dark:text-high",
  medium:
    "bg-medium/20 text-[color-mix(in_oklch,var(--medium),black_42%)] dark:bg-medium/20 dark:text-medium",
  low: "bg-low/12 text-[color-mix(in_oklch,var(--low),black_12%)] dark:bg-low/20 dark:text-low",
  success:
    "bg-success/12 text-[color-mix(in_oklch,var(--success),black_15%)] dark:bg-success/20 dark:text-success",
  warning:
    "bg-warning/18 text-[color-mix(in_oklch,var(--warning),black_42%)] dark:bg-warning/20 dark:text-warning",
  paused: "bg-paused/12 text-paused dark:bg-paused/20",
  primary: "bg-primary/10 text-primary dark:bg-primary/20",
  neutral: "bg-muted text-muted-foreground",
} as const

export type Tone = keyof typeof TONE

export const SEVERITY_TONE: Record<Severity, Tone> = {
  Critical: "critical",
  High: "high",
  Medium: "medium",
  Low: "low",
}

export const SEVERITY_DOT: Record<Severity, string> = {
  Critical: "bg-critical",
  High: "bg-high",
  Medium: "bg-medium",
  Low: "bg-low",
}

const HEALTH_TONE: Record<Health, Tone> = {
  Green: "success",
  Amber: "warning",
  Red: "critical",
  Paused: "paused",
  "Not started": "neutral",
}

const FINDING_TONE: Record<FindingStatus, Tone> = {
  Open: "neutral",
  Triaged: "primary",
  "In Fix": "warning",
  "Ready for Retest": "paused",
  Closed: "success",
  Rejected: "neutral",
  "Risk Accepted": "neutral",
  "Won't Fix": "neutral",
}

export function ToneBadge({
  tone,
  className,
  children,
  dot,
}: {
  tone: Tone
  className?: string
  children: React.ReactNode
  dot?: boolean
}) {
  return (
    <Badge
      variant="secondary"
      className={cn("gap-1.5 px-2.5", TONE[tone], className)}
    >
      {dot && <span aria-hidden className="size-1.5 rounded-full bg-current" />}
      {children}
    </Badge>
  )
}

export function SeverityBadge({
  severity,
  className,
}: {
  severity: Severity
  className?: string
}) {
  return (
    <ToneBadge tone={SEVERITY_TONE[severity]} className={className}>
      {severity}
    </ToneBadge>
  )
}

export function HealthBadge({
  health,
  className,
}: {
  health: Health
  className?: string
}) {
  return (
    <ToneBadge tone={HEALTH_TONE[health]} dot className={className}>
      {health}
    </ToneBadge>
  )
}

export function FindingStatusBadge({ status }: { status: FindingStatus }) {
  return <ToneBadge tone={FINDING_TONE[status]}>{status}</ToneBadge>
}

export function SeverityDot({
  severity,
  className,
}: {
  severity: Severity
  className?: string
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "size-2 shrink-0 rounded-full",
        SEVERITY_DOT[severity],
        className
      )}
    />
  )
}

/** Open counts per severity with a visible letter, so severity never relies on colour alone. */
export function SeverityCounts({
  count,
  className,
}: {
  count: Record<Severity, number>
  className?: string
}) {
  return (
    <span
      className={cn("flex flex-nowrap gap-x-2 whitespace-nowrap", className)}
    >
      {(["Critical", "High", "Medium", "Low"] as Severity[]).map((s) => (
        <span
          key={s}
          title={`${s}: ${count[s]}`}
          className={cn(
            "inline-flex items-center gap-1 tabular",
            !count[s] && "text-muted-foreground"
          )}
        >
          <SeverityDot severity={s} className={cn(!count[s] && "opacity-30")} />
          <abbr title={s} className="no-underline">
            {s[0]}
          </abbr>
          <span className="font-medium">{count[s]}</span>
        </span>
      ))}
    </span>
  )
}
