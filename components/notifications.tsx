"use client"

import * as React from "react"
import Link from "next/link"
import {
  ArrowRightIcon,
  BellIcon,
  CalendarClockIcon,
  CheckCheckIcon,
  type LucideIcon,
  RefreshCwIcon,
  SirenIcon,
  TimerIcon,
} from "lucide-react"

import { useCurrentUser, useOrgPath } from "@/components/current-user"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { formatDate, todayIso } from "@/lib/dates"
import {
  buildNotices,
  type Notice,
  type NoticeKind,
  type NoticeTone,
} from "@/lib/notifications"
import { useDashboard } from "@/lib/store"
import { cn } from "@/lib/utils"

// Read state lives per user in this browser; one shared snapshot keeps the bell and the page in sync.
const listeners = new Set<() => void>()
const storageKey = (userId: string) => `pentest-scout-notices-read:${userId}`

function readRaw(userId: string) {
  try {
    return localStorage.getItem(storageKey(userId)) ?? "[]"
  } catch {
    return "[]"
  }
}

function writeIds(userId: string, ids: string[]) {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(ids))
  } catch {
    /* storage unavailable: read state just won't persist */
  }
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  window.addEventListener("storage", listener)
  return () => {
    listeners.delete(listener)
    window.removeEventListener("storage", listener)
  }
}

export function useNotifications() {
  const { data, products, findings, hydrated } = useDashboard()
  const user = useCurrentUser()
  const to = useOrgPath()
  const raw = React.useSyncExternalStore(
    subscribe,
    () => readRaw(user.id),
    () => "[]"
  )
  const read = React.useMemo(() => {
    try {
      return new Set<string>(JSON.parse(raw))
    } catch {
      return new Set<string>()
    }
  }, [raw])
  const items = React.useMemo(
    () =>
      hydrated
        ? buildNotices(data, products, findings, todayIso()).map((n) => ({
            ...n,
            href: to(n.href),
          }))
        : [],
    [data, products, findings, hydrated, to]
  )
  const unread = items.filter((n) => !read.has(n.id)).length

  // Only ids still in the feed are kept, so storage never grows without bound.
  const save = (ids: Iterable<string>) => {
    const live = new Set(items.map((n) => n.id))
    writeIds(
      user.id,
      [...new Set(ids)].filter((id) => live.has(id))
    )
  }
  return {
    items,
    hydrated,
    isRead: (id: string) => read.has(id),
    unread,
    markRead: (id: string) => save([...read, id]),
    markAllRead: () => save(items.map((n) => n.id)),
  }
}

const KIND_ICON: Record<NoticeKind, LucideIcon> = {
  deadline: TimerIcon,
  retest: RefreshCwIcon,
  cycle: CalendarClockIcon,
  event: SirenIcon,
}

const TONE: Record<NoticeTone, string> = {
  critical: "bg-critical/12 text-critical",
  warning:
    "bg-warning/18 text-[color-mix(in_oklch,var(--warning),black_42%)] dark:text-warning",
  paused: "bg-paused/12 text-paused",
  neutral: "bg-muted text-muted-foreground",
}

export function NoticeRow({
  notice,
  unread,
  onOpen,
}: {
  notice: Notice
  unread: boolean
  onOpen: () => void
}) {
  const Icon = KIND_ICON[notice.kind]
  return (
    <Link
      href={notice.href}
      onClick={onOpen}
      className="flex gap-3 rounded-3xl px-3 py-3 transition-colors outline-none hover:bg-muted/70 focus-visible:ring-3 focus-visible:ring-ring/30"
    >
      <span
        className={cn(
          "grid size-8 shrink-0 place-items-center rounded-full",
          TONE[notice.tone]
        )}
      >
        <Icon className="size-4" />
      </span>
      <span className="grid min-w-0 flex-1 gap-0.5">
        <span className="flex items-start gap-2">
          <span
            className={cn(
              "flex-1 text-sm text-pretty",
              unread ? "font-medium text-foreground" : "text-muted-foreground"
            )}
          >
            {notice.title}
          </span>
          <time
            dateTime={notice.date}
            className="shrink-0 pt-0.5 text-xs text-muted-foreground tabular"
          >
            {formatDate(notice.date)}
          </time>
        </span>
        <span className="line-clamp-2 text-xs text-muted-foreground">
          {notice.detail}
        </span>
      </span>
      <span className="w-2 shrink-0 pt-2">
        {unread && (
          <span className="block size-2 rounded-full bg-foreground">
            <span className="sr-only">Unread</span>
          </span>
        )}
      </span>
    </Link>
  )
}

export function NotificationBell() {
  const { items, unread, isRead, markRead, markAllRead } = useNotifications()
  const to = useOrgPath()
  const [open, setOpen] = React.useState(false)
  const latest = items.slice(0, 6)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative rounded-full"
          aria-label={
            unread ? `Notifications, ${unread} unread` : "Notifications"
          }
        >
          <BellIcon />
          {unread > 0 && (
            <span
              aria-hidden
              className="absolute top-0.5 right-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-foreground px-1 text-[0.625rem] leading-none font-semibold text-background tabular ring-2 ring-background"
            >
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-[min(24rem,calc(100vw-2rem))] gap-0 p-0"
      >
        <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
          <span className="font-medium">Notifications</span>
          <Button
            variant="ghost"
            size="sm"
            disabled={!unread}
            onClick={markAllRead}
          >
            <CheckCheckIcon data-icon="inline-start" />
            Mark all read
          </Button>
        </div>
        {latest.length ? (
          <ul className="grid max-h-[26rem] gap-0.5 overflow-y-auto p-1.5">
            {latest.map((n) => (
              <li key={n.id}>
                <NoticeRow
                  notice={n}
                  unread={!isRead(n.id)}
                  onOpen={() => {
                    markRead(n.id)
                    setOpen(false)
                  }}
                />
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">
            You’re all caught up.
          </p>
        )}
        <div className="border-t p-1.5">
          <Button variant="ghost" className="w-full justify-center" asChild>
            <Link
              href={to("/notifications")}
              onClick={() => setOpen(false)}
            >
              View all notifications
              <ArrowRightIcon data-icon="inline-end" />
            </Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
