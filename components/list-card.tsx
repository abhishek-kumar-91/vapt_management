"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { SearchIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  STICKY_TOOLBAR,
  TableCell,
  TableRow,
  useStickyToolbar,
} from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

type Option = { value: string; label: string; count?: number }

/** Params that page through results; any filter change starts again from the first page. */
const CURSORS = ["before"]

/**
 * The list toolbar used across the console, driven by the URL so filters survive reloads and can
 * be shared: status tabs with counts, a search box, and one filter select. Same look as Team.
 */
export function ListToolbar({
  tabs,
  search,
  select,
}: {
  tabs?: { param: string; options: Option[]; label: string }
  search?: { placeholder: string; label: string }
  select?: { param: string; options: Option[]; label: string }
}) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [query, setQuery] = React.useState(params.get("q") ?? "")

  const update = React.useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(params)
      if (value) next.set(key, value)
      else next.delete(key)
      CURSORS.forEach((c) => next.delete(c))
      router.replace(next.size ? `${pathname}?${next}` : pathname, { scroll: false })
    },
    [params, pathname, router]
  )

  // Search as you type, a beat after the last key.
  React.useEffect(() => {
    if (query === (params.get("q") ?? "")) return
    const t = setTimeout(() => update("q", query.trim()), 300)
    return () => clearTimeout(t)
  }, [query, params, update])

  return (
    <>
      {tabs && (
        <Tabs
          value={params.get(tabs.param) ?? ""}
          onValueChange={(v) => update(tabs.param, v)}
          className="max-w-full overflow-x-auto"
        >
          <TabsList aria-label={tabs.label}>
            {tabs.options.map((o) => (
              <TabsTrigger key={o.value || "all"} value={o.value} className="gap-1.5">
                {o.label}
                {o.count !== undefined && (
                  <span className="text-xs text-muted-foreground tabular">{o.count}</span>
                )}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      )}
      <div className="flex w-full flex-wrap gap-2 sm:w-auto">
        {search && (
          <InputGroup className="w-full sm:w-64">
            <InputGroupAddon>
              <SearchIcon />
            </InputGroupAddon>
            <InputGroupInput
              type="search"
              aria-label={search.label}
              placeholder={search.placeholder}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </InputGroup>
        )}
        {select && (
          <Select
            value={params.get(select.param) || "__all__"}
            onValueChange={(v) => update(select.param, v === "__all__" ? "" : v)}
          >
            <SelectTrigger aria-label={select.label} className="w-full sm:w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {select.options.map((o) => (
                <SelectItem key={o.value || "__all__"} value={o.value || "__all__"}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
    </>
  )
}

/** A table in a card with the sticky toolbar on top, as on the Team page. */
export function ListCard({
  toolbar,
  children,
  more,
}: {
  toolbar?: React.ReactNode
  children: React.ReactNode
  /** Link to the next page of results (keyset pagination). */
  more?: { href: string; label: string } | null
}) {
  const toolbarRef = useStickyToolbar()
  return (
    <Card className={cn("animate-settle gap-1", toolbar ? "pt-3" : "py-0")}>
      {toolbar && (
        <CardHeader
          ref={toolbarRef}
          className={cn("flex flex-wrap items-center justify-between gap-3", STICKY_TOOLBAR)}
        >
          {toolbar}
        </CardHeader>
      )}
      <CardContent className="px-0">{children}</CardContent>
      {more && (
        <div className="flex justify-center border-t px-6 py-3">
          <Button asChild variant="ghost" size="sm">
            <Link href={more.href} scroll={false}>
              {more.label}
            </Link>
          </Button>
        </div>
      )}
    </Card>
  )
}

/** The empty state inside a table body. */
export function EmptyRow({
  cols,
  title,
  children,
}: {
  cols: number
  title: string
  children?: React.ReactNode
}) {
  return (
    <TableRow className="hover:bg-transparent">
      <TableCell colSpan={cols} className="p-0 whitespace-normal">
        {/* Pinned to the visible width, so it stays readable when a wide table scrolls sideways. */}
        <Empty className="sticky left-0 max-w-[calc(100vw-2rem)] py-12 md:max-w-none">
          <EmptyHeader>
            <EmptyTitle>{title}</EmptyTitle>
            {children && <EmptyDescription>{children}</EmptyDescription>}
          </EmptyHeader>
        </Empty>
      </TableCell>
    </TableRow>
  )
}

/** Name with email underneath, behind an initials avatar: how people appear in every table. */
export function PersonCell({
  name,
  detail,
  muted = false,
}: {
  name: string
  detail?: React.ReactNode
  muted?: boolean
}) {
  const initials =
    name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((p, i, all) => (i === 0 || i === all.length - 1 ? p[0] : ""))
      .join("")
      .toUpperCase() || "?"
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span
        aria-hidden
        className={cn(
          "grid size-9 shrink-0 place-items-center rounded-full text-xs font-semibold tracking-tight",
          muted ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary dark:bg-primary/20"
        )}
      >
        {initials.slice(0, 2)}
      </span>
      <div className="grid min-w-0 gap-0.5">
        <span className="truncate font-medium">{name}</span>
        {detail && <span className="truncate text-xs text-muted-foreground">{detail}</span>}
      </div>
    </div>
  )
}
