import { ToneBadge, type Tone } from "@/components/status"
import { ORG_STATUS_LABELS } from "@/lib/orgs"

type OrgStatus = keyof typeof ORG_STATUS_LABELS

const ORG_TONE: Record<OrgStatus, Tone> = {
  draft: "neutral",
  pending_review: "warning",
  active: "success",
  rejected: "critical",
  suspended: "paused",
  closed: "neutral",
}

export function OrgStatusBadge({ status }: { status: string }) {
  const s = status as OrgStatus
  return (
    <ToneBadge tone={ORG_TONE[s] ?? "neutral"} dot>
      {ORG_STATUS_LABELS[s] ?? status}
    </ToneBadge>
  )
}

/** "14 Nov 2026" (or "—"), from a Date or ISO string. */
export function day(value: Date | string | null | undefined, withTime = false) {
  if (!value) return "—"
  const d = typeof value === "string" ? new Date(value) : value
  return d.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
    timeZone: "UTC",
  })
}
