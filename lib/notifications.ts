import { addDays, dateDiff } from "./dates"
import { cycleRows, isClosed, retestDueFor } from "./metrics"
import type { DashboardData, Finding, Product } from "./types"

export type NoticeKind = "deadline" | "retest" | "cycle" | "event"
export type NoticeTone = "critical" | "warning" | "paused" | "neutral"

export interface Notice {
  /** Stable while the underlying fact is unchanged, so read state survives reloads. */
  id: string
  kind: NoticeKind
  tone: NoticeTone
  title: string
  detail: string
  /** ISO day the notice is about; newest first. */
  date: string
  href: string
}

const EVENT_TYPES = ["Escalation", "Incident", "Close-out", "Switch"]
const EVENT_DAYS = 14
const CYCLE_SOON_DAYS = 3

const late = (days: number) => (days === 1 ? "1 day" : `${days} days`)

/**
 * Notifications are derived from the records, using the same SOP rules as the
 * overview: fix deadlines, retest targets, cycle due dates and key events.
 */
export function buildNotices(
  data: DashboardData,
  products: Product[],
  findings: Finding[],
  today: string
): Notice[] {
  const name = (id: string) => data.products[id]?.name ?? id
  const notices: Notice[] = []

  for (const f of findings) {
    if (isClosed(f)) continue
    const href = `/products/${f.product}`
    if (f.status === "Ready for Retest") {
      const due = retestDueFor(f)
      const over = due ? dateDiff(due, today) : 0
      notices.push(
        over > 0
          ? {
              id: `retest-late:${f.id}:${due}`,
              kind: "retest",
              tone: "critical",
              title: `Retest for ${f.id} is ${late(over)} past target`,
              detail: `${name(f.product)} · ${f.title}`,
              date: due!,
              href,
            }
          : {
              id: `retest:${f.id}:${f.readyDate ?? ""}`,
              kind: "retest",
              tone: "paused",
              title: `${f.id} is ready for retest`,
              detail: `${name(f.product)} · ${f.title}`,
              date: f.readyDate || today,
              href,
            }
      )
    } else if (f.due && f.due < today) {
      notices.push({
        id: `deadline:${f.id}:${f.due}`,
        kind: "deadline",
        tone: "critical",
        title: `${f.id} is ${late(dateDiff(f.due, today))} past its fix deadline`,
        detail: `${f.severity} · ${name(f.product)} · ${f.title}`,
        date: f.due,
        href,
      })
    }
  }

  const soon = addDays(today, CYCLE_SOON_DAYS)
  for (const p of products) {
    for (const row of cycleRows(p)) {
      if (!row.next || row.next > soon) continue
      const over = dateDiff(row.next, today)
      notices.push({
        id: `cycle:${p.id}:${row.source}:${row.next}`,
        kind: "cycle",
        tone: over > 0 ? "warning" : "neutral",
        title:
          over > 0
            ? `${row.title} is ${late(over)} overdue`
            : over === 0
              ? `${row.title} is due today`
              : `${row.title} is due in ${late(-over)}`,
        detail: `${p.name} · ${row.frequency}`,
        date: row.next,
        href: `/products/${p.id}`,
      })
    }
  }

  const since = addDays(today, -EVENT_DAYS)
  data.events.forEach((e) => {
    if (!EVENT_TYPES.includes(e.type) || e.date < since) return
    notices.push({
      id: `event:${e.date}:${e.type}:${e.text.slice(0, 60)}`,
      kind: "event",
      tone:
        e.type === "Close-out"
          ? "neutral"
          : e.type === "Switch"
            ? "warning"
            : "critical",
      title: e.type === "Switch" ? "Product status changed" : e.type,
      detail: e.product ? `${name(e.product)} · ${e.text}` : e.text,
      date: e.date,
      href: e.product
        ? `/products/${e.product}`
        : "/activity",
    })
  })

  return notices.sort((a, b) => b.date.localeCompare(a.date))
}
