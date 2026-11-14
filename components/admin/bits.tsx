import { ToneBadge, type Tone } from "@/components/status"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { TableCell, TableRow } from "@/components/ui/table"
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

export function EmptyRow({ cols, children }: { cols: number; children: React.ReactNode }) {
  return (
    <TableRow className="hover:bg-transparent">
      <TableCell colSpan={cols} className="py-10 text-center text-sm text-muted-foreground">
        {children}
      </TableCell>
    </TableRow>
  )
}

/** A GET filter bar: plain form, so filters live in the URL and survive reloads. */
export function FilterBar({
  q,
  placeholder,
  select,
}: {
  q?: string
  placeholder: string
  select?: { name: string; value?: string; options: { value: string; label: string }[] }
}) {
  return (
    <form method="get" className="flex flex-wrap items-center gap-2" role="search">
      <Input
        name="q"
        defaultValue={q}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-10 w-full sm:w-72"
      />
      {select && (
        <select
          name={select.name}
          defaultValue={select.value ?? ""}
          aria-label="Filter"
          className="h-10 rounded-2xl border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
        >
          {select.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}
      <Button type="submit" variant="outline" className="h-10">
        Filter
      </Button>
    </form>
  )
}
