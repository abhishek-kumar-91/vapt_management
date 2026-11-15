"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { PlusIcon, SearchIcon } from "lucide-react"

import { FindingFormSheet } from "@/components/findings/finding-form-sheet"
import { FindingsTable } from "@/components/findings/findings-table"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { STICKY_TOOLBAR, useStickyToolbar } from "@/components/ui/table"
import { cn } from "@/lib/utils"
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { isClosed } from "@/lib/metrics"
import { SEVERITIES } from "@/lib/sop"
import { useDashboard } from "@/lib/store"
import { useOrgPath } from "@/components/current-user"

const VIEWS = [
  { value: "open", label: "Open" },
  { value: "retest", label: "Ready for retest" },
  { value: "closed", label: "Closed" },
  { value: "all", label: "All" },
] as const

function FindingsView() {
  const to = useOrgPath()
  const { findings, products } = useDashboard()
  const params = useSearchParams()
  const router = useRouter()
  const [view, setView] = React.useState<string>("open")
  const [severity, setSeverity] = React.useState("all")
  const [product, setProduct] = React.useState("all")
  const toolbarRef = useStickyToolbar()
  const [query, setQuery] = React.useState("")
  const formOpen = params.get("new") === "1"
  const setFormOpen = (open: boolean) =>
    router.replace(open ? to("/findings?new=1") : to("/findings"), {
      scroll: false,
    })

  const counts = {
    open: findings.filter((f) => !isClosed(f)).length,
    retest: findings.filter((f) => f.status === "Ready for Retest").length,
    closed: findings.filter(isClosed).length,
    all: findings.length,
  }
  const q = query.trim().toLowerCase()
  const filtered = !!q || severity !== "all" || product !== "all"
  const visible = findings.filter(
    (f) =>
      (view === "all" ||
        (view === "open" && !isClosed(f)) ||
        (view === "closed" && isClosed(f)) ||
        (view === "retest" && f.status === "Ready for Retest")) &&
      (severity === "all" || f.severity === severity) &&
      (product === "all" || f.product === product) &&
      (!q || `${f.id} ${f.title}`.toLowerCase().includes(q))
  )

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Findings"
        description="Track remediation, SLA dates and retest requests. Exit statuses require a reason."
        actions={
          <Button onClick={() => setFormOpen(true)}>
            <PlusIcon data-icon="inline-start" />
            Report finding
          </Button>
        }
      />

      <Card className="gap-1 pt-3">
        <CardHeader
          ref={toolbarRef}
          className={cn(
            "flex flex-wrap items-center justify-between gap-3",
            STICKY_TOOLBAR
          )}
        >
          <Tabs
            value={view}
            onValueChange={setView}
            controls="findings-results"
          >
            <TabsList>
              {VIEWS.map((v) => (
                <TabsTrigger key={v.value} value={v.value} className="gap-1.5">
                  {v.label}
                  <span className="text-xs text-muted-foreground tabular">
                    {counts[v.value]}
                  </span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <div className="flex flex-wrap gap-2">
            <InputGroup className="w-full sm:w-56">
              <InputGroupAddon>
                <SearchIcon />
              </InputGroupAddon>
              <InputGroupInput
                aria-label="Search findings"
                placeholder="Search ID or title"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </InputGroup>
            <Select value={severity} onValueChange={setSeverity}>
              <SelectTrigger aria-label="Filter by severity" className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All severities</SelectItem>
                {SEVERITIES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={product} onValueChange={setProduct}>
              <SelectTrigger aria-label="Filter by product" className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All products</SelectItem>
                {products.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent id="findings-results" className="px-0">
          <FindingsTable
            findings={visible}
            resetKey={`${view}|${severity}|${product}|${q}`}
            emptyText={
              filtered ? (
                <span className="grid justify-items-center gap-3">
                  No findings match these filters.
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSeverity("all")
                      setProduct("all")
                      setQuery("")
                    }}
                  >
                    Clear filters
                  </Button>
                </span>
              ) : (
                "No findings in this view."
              )
            }
          />
        </CardContent>
      </Card>

      <FindingFormSheet open={formOpen} onOpenChange={setFormOpen} />
    </div>
  )
}

export default function FindingsPage() {
  return (
    <React.Suspense>
      <FindingsView />
    </React.Suspense>
  )
}
