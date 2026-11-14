"use client"

import * as React from "react"
import { cn } from "cn"

function Table({ className, ...props }: React.ComponentProps<"table">) {
  // A table that scrolls sideways must be reachable by keyboard (WCAG 2.1.1);
  // only take a tab stop while it actually overflows. It only becomes a scroll
  // container then too, so the sticky header can track the page otherwise.
  const ref = React.useRef<HTMLDivElement>(null)
  const [scrolls, setScrolls] = React.useState(false)
  React.useEffect(() => {
    const el = ref.current
    if (!el) return
    const check = () => setScrolls(el.scrollWidth > el.clientWidth + 1)
    const observer = new ResizeObserver(check)
    observer.observe(el)
    if (el.firstElementChild) observer.observe(el.firstElementChild)
    return () => observer.disconnect()
  }, [])
  return (
    <div
      ref={ref}
      data-slot="table-container"
      tabIndex={scrolls ? 0 : undefined}
      className={cn(
        // contain:inline-size keeps a wide table from stretching the page grid, so the
        // overflow above is measurable instead of widening the layout to fit.
        "relative w-full rounded-xl outline-none [contain:inline-size] focus-visible:ring-2 focus-visible:ring-ring/50",
        scrolls && "overflow-x-auto"
      )}
    >
      <table
        data-slot="table"
        className={cn("w-full caption-bottom text-sm", className)}
        {...props}
      />
    </div>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      // Sticks under the 3.5rem site header, plus any sticky toolbar above it. Collapsed-table borders don't travel
      // with a sticky row, so the divider is an inset shadow on each cell.
      className={cn(
        "sticky top-[calc(3.5rem+var(--table-sticky-top,0px))] z-[5] bg-card [&_th]:shadow-[inset_0_-1px_0_var(--color-border)]",
        className
      )}
      {...props}
    />
  )
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  )
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        "border-t bg-muted/50 font-medium [&>tr]:last:border-b-0",
        className
      )}
      {...props}
    />
  )
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "border-b transition-colors hover:bg-muted/50 has-aria-expanded:bg-muted/50 data-[state=selected]:bg-muted",
        className
      )}
      {...props}
    />
  )
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "h-12 px-3 text-left align-middle font-medium whitespace-nowrap text-foreground [&:has([role=checkbox])]:pr-0",
        className
      )}
      {...props}
    />
  )
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "p-3 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0",
        className
      )}
      {...props}
    />
  )
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("mt-4 text-sm text-muted-foreground", className)}
      {...props}
    />
  )
}

/**
 * Pins a table's filter bar (its CardHeader) under the site header from `md`
 * up and stacks the column header beneath it. Pass the returned ref to the
 * CardHeader along with `STICKY_TOOLBAR`.
 */
function useStickyToolbar() {
  const ref = React.useCallback((el: HTMLDivElement | null) => {
    const card = el?.parentElement
    if (!el || !card) return
    const sync = () =>
      card.style.setProperty(
        "--table-sticky-top",
        getComputedStyle(el).position === "sticky"
          ? `${el.offsetHeight}px`
          : "0px"
      )
    sync()
    const observer = new ResizeObserver(sync)
    observer.observe(el)
    window.addEventListener("resize", sync)
    return () => {
      observer.disconnect()
      window.removeEventListener("resize", sync)
    }
  }, [])
  return ref
}

// py-3 keeps the bar off the site header once stuck; pair the Card with
// `gap-1 pt-3` so resting spacing still totals 24px above and 16px below.
const STICKY_TOOLBAR = "bg-card py-3 md:sticky md:top-14 md:z-[6]"

export {
  STICKY_TOOLBAR,
  useStickyToolbar,
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}
