const pad = (n: number) => String(n).padStart(2, "0")
export const toIso = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const local = (value: string) => new Date(`${value}T00:00:00`)

export function todayIso() {
  return toIso(new Date())
}

export function formatDate(
  value: string | undefined,
  options: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" }
) {
  if (!value) return "—"
  const date = local(value)
  return Number.isNaN(date.getTime())
    ? "—"
    : new Intl.DateTimeFormat("en-GB", options).format(date)
}

export const LONG_DATE: Intl.DateTimeFormatOptions = {
  day: "numeric",
  month: "short",
  year: "numeric",
}

export function isWorkday(date: Date) {
  return date.getDay() !== 0 && date.getDay() !== 6
}

/** Working days after `from`, up to and including `to`. */
export function workdaysBetween(from?: string, to?: string) {
  if (!from || !to || from >= to) return 0
  const date = local(from)
  const end = local(to)
  let count = 0
  while (date < end) {
    date.setDate(date.getDate() + 1)
    if (date <= end && isWorkday(date)) count += 1
  }
  return count
}

export function addWorkdays(from: string | undefined, count: number) {
  if (!from) return ""
  const date = local(from)
  let added = 0
  while (added < count) {
    date.setDate(date.getDate() + 1)
    if (isWorkday(date)) added += 1
  }
  return toIso(date)
}

export function addMonths(value: string | undefined, count: number) {
  if (!value) return ""
  const date = new Date(`${value}T00:00:00Z`)
  const originalDay = date.getUTCDate()
  date.setUTCDate(1)
  date.setUTCMonth(date.getUTCMonth() + count)
  const lastDay = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)
  ).getUTCDate()
  date.setUTCDate(Math.min(originalDay, lastDay))
  return date.toISOString().slice(0, 10)
}

export function addDays(value: string | undefined, count: number) {
  if (!value) return ""
  const date = new Date(`${value}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + count)
  return date.toISOString().slice(0, 10)
}

export function dateDiff(from?: string, to?: string) {
  if (!from || !to) return 0
  return Math.round((local(to).getTime() - local(from).getTime()) / 86400000)
}
