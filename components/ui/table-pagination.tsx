"use client"

import * as React from "react"
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import { cn } from "cn"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const PAGE_SIZES = [10, 25, 50]

/** 1 … 4 5 6 … 12: first, last, and the current page's neighbours. */
function pageList(page: number, count: number): (number | "gap")[] {
  if (count <= 7) return Array.from({ length: count }, (_, i) => i + 1)
  let from = Math.max(2, Math.min(page - 1, count - 4))
  let to = Math.min(count - 1, Math.max(page + 1, 5))
  // An ellipsis must hide at least two pages; show a lone page instead.
  if (from === 3) from = 2
  if (to === count - 2) to = count - 1
  const middle = Array.from({ length: to - from + 1 }, (_, i) => from + i)
  return [
    1,
    ...(from > 2 ? (["gap"] as const) : []),
    ...middle,
    ...(to < count - 1 ? (["gap"] as const) : []),
    count,
  ]
}

const pageButton =
  "inline-flex h-7 min-w-7 items-center justify-center rounded-full px-2 text-sm font-medium tabular-nums transition-colors outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-40 aria-[current=page]:bg-background aria-[current=page]:text-foreground dark:aria-[current=page]:bg-input/30 [&_svg]:size-4"

/**
 * Client-side paging for a table. Renders `children(rows)` plus a footer that
 * appears once there's more than one page. Returns to page 1 whenever
 * `resetKey` (the active filters) changes.
 */
function Paginated<T>({
  items,
  resetKey = "",
  noun,
  children,
}: {
  items: T[]
  resetKey?: string
  noun: string
  children: (rows: T[]) => React.ReactNode
}) {
  const [state, setState] = React.useState({
    page: 1,
    size: PAGE_SIZES[0],
    key: resetKey,
  })
  if (state.key !== resetKey) setState({ ...state, page: 1, key: resetKey })

  const nav = React.useRef<HTMLElement>(null)
  const total = items.length
  const pageCount = Math.max(1, Math.ceil(total / state.size))
  const page = Math.min(state.page, pageCount)
  const start = (page - 1) * state.size
  const end = Math.min(start + state.size, total)

  const go = (next: number) => {
    setState((s) => ({ ...s, page: next }))
    // Paging from the bottom of a long page lands you on the new page's top.
    const card = nav.current?.closest("[data-slot=card]")
    const top = card?.getBoundingClientRect().top ?? 0
    if (top < 72)
      window.scrollBy({
        top: top - 72,
        behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
      })
  }

  return (
    <>
      {children(items.slice(start, end))}
      {total > PAGE_SIZES[0] && (
        <nav
          ref={nav}
          aria-label={`${noun} pages`}
          className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-t px-6 pt-4"
        >
          <p aria-live="polite" className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground tabular-nums">
              {start + 1}–{end}
            </span>{" "}
            of <span className="tabular-nums">{total}</span> {noun}
          </p>
          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 text-sm text-muted-foreground sm:flex">
              <span aria-hidden>Rows</span>
              <Select
                value={String(state.size)}
                onValueChange={(v) => {
                  const size = Number(v)
                  // Keep the first row you were looking at on screen.
                  setState((s) => ({
                    ...s,
                    size,
                    page: Math.floor(start / size) + 1,
                  }))
                }}
              >
                <SelectTrigger
                  size="sm"
                  aria-label="Rows per page"
                  className="tabular-nums"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper" align="end">
                  {PAGE_SIZES.map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="inline-flex h-9 items-center gap-0.5 rounded-full bg-muted p-1 text-muted-foreground">
              <button
                type="button"
                className={pageButton}
                aria-label="Previous page"
                disabled={page === 1}
                onClick={() => go(page - 1)}
              >
                <ChevronLeftIcon />
              </button>
              <span className="px-2 text-sm font-medium text-foreground tabular-nums sm:hidden">
                {page} / {pageCount}
              </span>
              {pageList(page, pageCount).map((p, i) =>
                p === "gap" ? (
                  <span
                    key={`gap-${i}`}
                    aria-hidden
                    className="hidden w-5 text-center text-sm sm:inline"
                  >
                    …
                  </span>
                ) : (
                  <button
                    key={p}
                    type="button"
                    className={cn(pageButton, "max-sm:hidden")}
                    aria-label={`Page ${p}`}
                    aria-current={p === page ? "page" : undefined}
                    onClick={() => go(p)}
                  >
                    {p}
                  </button>
                )
              )}
              <button
                type="button"
                className={pageButton}
                aria-label="Next page"
                disabled={page === pageCount}
                onClick={() => go(page + 1)}
              >
                <ChevronRightIcon />
              </button>
            </div>
          </div>
        </nav>
      )}
    </>
  )
}

export { Paginated, pageList }
