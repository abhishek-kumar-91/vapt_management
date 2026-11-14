"use client"

import * as React from "react"
import type { LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

export interface SettingsNavItem {
  id: string
  label: string
  icon: LucideIcon
}

/** Highlights the section currently in the reading band of the viewport. */
function useActiveSection(ids: string[]) {
  const [active, setActive] = React.useState(ids[0])
  React.useEffect(() => {
    const visible = new Map<string, boolean>()
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => visible.set(e.target.id, e.isIntersecting))
        const first = ids.find((id) => visible.get(id))
        if (first) setActive(first)
      },
      { rootMargin: "-20% 0px -65% 0px" }
    )
    ids.forEach((id) => {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    })
    return () => observer.disconnect()
  }, [ids])
  return active
}

/**
 * Settings frame: a sticky section rail beside the sections at lg, a scrollable
 * pill row above them on smaller screens. Sections are deep-linkable by hash.
 */
export function SettingsLayout({
  items,
  children,
}: {
  items: SettingsNavItem[]
  children: React.ReactNode
}) {
  const ids = React.useMemo(() => items.map((item) => item.id), [items])
  const active = useActiveSection(ids)

  return (
    <div className="grid gap-6 lg:grid-cols-[12rem_minmax(0,56rem)] lg:gap-10">
      <nav aria-label="Settings sections" className="min-w-0">
        <ul className="-mx-4 flex [scrollbar-width:none] gap-1.5 overflow-x-auto px-4 pb-1 lg:sticky lg:top-20 lg:mx-0 lg:grid lg:gap-0.5 lg:overflow-visible lg:px-0">
          {items.map(({ id, label, icon: Icon }) => {
            const current = active === id
            return (
              <li key={id} className="shrink-0">
                <a
                  href={`#${id}`}
                  aria-current={current ? "location" : undefined}
                  className={cn(
                    "flex h-9 items-center gap-2.5 rounded-full px-3.5 text-sm whitespace-nowrap transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/30",
                    current
                      ? "bg-accent font-medium text-foreground"
                      : "text-muted-foreground ring-1 ring-border hover:bg-muted/50 hover:text-foreground lg:ring-0"
                  )}
                >
                  <Icon className="size-4 shrink-0" aria-hidden />
                  {label}
                </a>
              </li>
            )
          })}
        </ul>
      </nav>
      <div className="grid min-w-0 gap-6">{children}</div>
    </div>
  )
}

/** One settings area: titled card of rows, with an optional scope badge and footer. */
export function SettingsSection({
  id,
  title,
  description,
  scope,
  footer,
  children,
}: {
  id: string
  title: string
  description: React.ReactNode
  scope?: string
  footer?: React.ReactNode
  children: React.ReactNode
}) {
  const headingId = `${id}-title`
  return (
    <section
      id={id}
      aria-labelledby={headingId}
      className="scroll-mt-20 rounded-4xl bg-card text-card-foreground shadow-md ring-1 ring-foreground/5"
    >
      <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 px-6 pt-6 pb-2">
        <div className="grid max-w-prose gap-1">
          <h2 id={headingId} className="text-base font-semibold tracking-tight">
            {title}
          </h2>
          <p className="text-sm text-pretty text-muted-foreground">
            {description}
          </p>
        </div>
        {scope && (
          <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
            {scope}
          </span>
        )}
      </header>
      <div className="divide-y divide-border px-6">{children}</div>
      {footer && (
        <footer className="flex flex-wrap items-center justify-end gap-2 rounded-b-4xl border-t bg-muted/40 px-6 py-3">
          {footer}
        </footer>
      )}
    </section>
  )
}

/** Label and help on the left, control on the right; stacks below md. */
export function SettingsRow({
  label,
  description,
  htmlFor,
  children,
}: {
  label: string
  description?: React.ReactNode
  htmlFor?: string
  children: React.ReactNode
}) {
  const Label = htmlFor ? "label" : "div"
  return (
    <div className="grid gap-3 py-5 md:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] md:gap-8">
      <div className="grid content-start gap-1">
        <Label htmlFor={htmlFor} className="text-sm font-medium">
          {label}
        </Label>
        {description && (
          <p className="text-xs/relaxed text-pretty text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      <div className="@container min-w-0">{children}</div>
    </div>
  )
}
