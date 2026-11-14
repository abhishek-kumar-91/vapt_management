"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { CornerDownLeftIcon, PlusIcon, SearchIcon } from "lucide-react"

import { PAGES } from "@/components/app-sidebar"
import { useCan } from "@/components/current-user"
import { ProductAvatar } from "@/components/product-avatar"
import { SeverityDot } from "@/components/status"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command"
import { Kbd } from "@/components/ui/kbd"
import { isClosed } from "@/lib/metrics"
import { useDashboard } from "@/lib/store"

/** Every typed word must appear somewhere in the item; cmdk's default fuzzy match is too loose for IDs. */
function matchAllWords(value: string, search: string, keywords?: string[]) {
  const haystack = `${value} ${keywords?.join(" ") ?? ""}`.toLowerCase()
  const words = search.toLowerCase().split(/\s+/).filter(Boolean)
  if (!words.every((word) => haystack.includes(word))) return 0
  return haystack.startsWith(words[0]) ? 1 : 0.5
}

/** Header search: one ⌘K palette over pages, products, findings and test areas. */
export function GlobalSearch() {
  const router = useRouter()
  const { products, findings } = useDashboard()
  const canSeeUsers = useCan("user.read")
  const canReport = useCan("finding.create")
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const typed = query.trim().length > 0

  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        setOpen((value) => !value)
      }
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [])

  const go = (href: string) => {
    setOpen(false)
    setQuery("")
    router.push(href)
  }
  const pages = PAGES.filter(
    (page) => page.href !== "/dashboard/users" || canSeeUsers
  )

  return (
    <>
      <Button
        variant="ghost"
        onClick={() => setOpen(true)}
        aria-label="Search"
        aria-keyshortcuts="Meta+K Control+K"
        className="size-9 rounded-full p-0 text-muted-foreground sm:h-9 sm:w-64 sm:justify-start sm:gap-2 sm:bg-input/50 sm:px-3 sm:font-normal sm:hover:bg-input/80 lg:w-72"
      >
        <SearchIcon />
        <span className="hidden sm:inline">Search…</span>
        <Kbd className="ml-auto hidden bg-background sm:inline-flex">⌘K</Kbd>
      </Button>

      <CommandDialog
        open={open}
        onOpenChange={(value) => {
          setOpen(value)
          if (!value) setQuery("")
        }}
        title="Search Pentest Scout"
        description="Find pages, products, findings and test areas."
      >
        <Command filter={matchAllWords}>
          <CommandInput
            placeholder="Search pages, products, findings, test areas…"
            value={query}
            onValueChange={setQuery}
          />
          <CommandList className="max-h-[min(26rem,60svh)]">
            <CommandEmpty>No matches for “{query.trim()}”.</CommandEmpty>

            {canReport && (
              <CommandGroup heading="Actions">
                <CommandItem
                  value="Report finding new create"
                  onSelect={() => go("/dashboard/findings?new=1")}
                >
                  <PlusIcon />
                  Report a finding
                </CommandItem>
              </CommandGroup>
            )}

            <CommandGroup heading="Pages">
              {pages.map((page) => (
                <CommandItem
                  key={page.href}
                  value={page.label}
                  onSelect={() => go(page.href)}
                >
                  <page.icon />
                  {page.label}
                </CommandItem>
              ))}
            </CommandGroup>

            <CommandGroup heading="Products">
              {products.map((product) => (
                <CommandItem
                  key={product.id}
                  value={product.name}
                  keywords={[product.domain ?? "", `tier ${product.tier}`]}
                  onSelect={() => go(`/dashboard/products/${product.id}`)}
                >
                  <ProductAvatar
                    id={product.id}
                    name={product.name}
                    className="size-5 text-[0.5625rem]"
                  />
                  <span className="truncate">{product.name}</span>
                  <CommandShortcut className="shrink-0 pl-3 tracking-normal whitespace-nowrap">
                    Tier {product.tier}
                  </CommandShortcut>
                </CommandItem>
              ))}
            </CommandGroup>

            {/* Findings and test areas only once something is typed, so the empty palette stays short. */}
            {typed && (
              <CommandGroup heading="Findings">
                {findings.map((finding) => (
                  <CommandItem
                    key={finding.id}
                    value={`${finding.id} ${finding.title}`}
                    keywords={[finding.severity, finding.status]}
                    onSelect={() =>
                      go(`/dashboard/products/${finding.product}`)
                    }
                  >
                    <SeverityDot severity={finding.severity} />
                    <span className="shrink-0 font-mono text-xs text-muted-foreground">
                      {finding.id}
                    </span>
                    <span className="truncate">{finding.title}</span>
                    <CommandShortcut className="shrink-0 pl-3 tracking-normal whitespace-nowrap">
                      {isClosed(finding) ? "Closed" : finding.status}
                    </CommandShortcut>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {typed && (
              <CommandGroup heading="Test areas">
                {products.flatMap((product) =>
                  (product.areas ?? []).map((area, index) => (
                    <CommandItem
                      key={`${product.id}-${index}`}
                      value={`${area.n} · ${product.name}`}
                      onSelect={() => go(`/dashboard/products/${product.id}`)}
                    >
                      <span className="truncate">{area.n}</span>
                      <CommandShortcut className="max-w-48 shrink-0 truncate pl-3 tracking-normal whitespace-nowrap">
                        {product.name} · {area.s}
                      </CommandShortcut>
                    </CommandItem>
                  ))
                )}
              </CommandGroup>
            )}
          </CommandList>
          <div className="flex items-center gap-3 border-t px-4 py-2.5 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Kbd>
                <CornerDownLeftIcon />
              </Kbd>
              Open
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Kbd>↑</Kbd>
              <Kbd>↓</Kbd>
              Move
            </span>
            <span className="ml-auto inline-flex items-center gap-1.5">
              <Kbd>Esc</Kbd>
              Close
            </span>
          </div>
        </Command>
      </CommandDialog>
    </>
  )
}
