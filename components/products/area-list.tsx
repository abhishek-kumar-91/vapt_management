"use client"

import * as React from "react"
import {
  CheckIcon,
  ChevronDownIcon,
  CircleDashedIcon,
  CircleDotIcon,
  OctagonXIcon,
} from "lucide-react"

import { ToneBadge } from "@/components/status"
import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { todayIso, workdaysBetween } from "@/lib/dates"
import { AREA_STATUSES } from "@/lib/sop"
import { useDashboard } from "@/lib/store"
import type { AreaStatus, Product, TestArea } from "@/lib/types"
import { cn } from "@/lib/utils"

const STATUS_ICON: Record<
  AreaStatus,
  { icon: React.ElementType; className: string }
> = {
  Tested: {
    icon: CheckIcon,
    className: "bg-success text-white dark:text-background",
  },
  "In Testing": {
    icon: CircleDotIcon,
    className: "bg-primary/12 text-primary",
  },
  Blocked: { icon: OctagonXIcon, className: "bg-critical/12 text-critical" },
  "To Do": {
    icon: CircleDashedIcon,
    className: "bg-muted text-muted-foreground",
  },
}

function AreaRow({
  product,
  area,
  index,
}: {
  product: Product
  area: TestArea
  index: number
}) {
  const { actions } = useDashboard()
  const [open, setOpen] = React.useState(false)
  const status = STATUS_ICON[area.s]
  const daysInTesting =
    area.s === "In Testing" && area.startedAt
      ? workdaysBetween(area.startedAt, todayIso())
      : 0
  const field = (key: keyof TestArea, value: string) =>
    actions.updateAreaField(product.id, index, key, value)
  const id = `${product.id}-area-${index}`

  return (
    <Collapsible open={open} onOpenChange={setOpen} asChild>
      <li
        className={cn(
          "rounded-3xl transition-colors",
          open ? "bg-muted/60" : "hover:bg-muted/40"
        )}
      >
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5">
          <span
            className={cn(
              "grid size-7 shrink-0 place-items-center rounded-full",
              status.className
            )}
          >
            <status.icon className="size-3.5" strokeWidth={2.5} />
          </span>
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-sm font-medium">{area.n}</span>
            {area.hr && <ToneBadge tone="high">High risk</ToneBadge>}
            {area.s === "Tested" && area.result === "No finding" && (
              <ToneBadge tone="success">No finding</ToneBadge>
            )}
            {area.s === "Tested" && area.result === "Finding raised" && (
              <ToneBadge tone="critical">Finding raised</ToneBadge>
            )}
            {daysInTesting >= 1 && (
              <ToneBadge tone="warning">
                {daysInTesting >= 2
                  ? "Move to another area"
                  : "Change method today"}
              </ToneBadge>
            )}
            {area.j && (
              <span className="font-mono text-xs text-muted-foreground">
                {area.j}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <Select
              value={area.s}
              onValueChange={(v) =>
                actions.updateArea(product.id, index, v as AreaStatus)
              }
            >
              <SelectTrigger
                size="sm"
                aria-label={`Status for ${area.n}`}
                className="w-32 bg-background"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper" align="end">
                {AREA_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <CollapsibleTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Test details for ${area.n}`}
              >
                <ChevronDownIcon
                  className={cn(
                    "transition-transform duration-200",
                    open && "rotate-180"
                  )}
                />
              </Button>
            </CollapsibleTrigger>
          </div>
        </div>
        <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
          <div className="grid gap-4 px-3 pt-1 pb-4 sm:grid-cols-2 sm:pl-13">
            <Field>
              <FieldLabel htmlFor={`${id}-method`}>Method</FieldLabel>
              <Input
                id={`${id}-method`}
                className="bg-background"
                value={area.method || ""}
                onChange={(e) => field("method", e.target.value)}
                placeholder="Testing method, roles and tools"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor={`${id}-result`}>Result</FieldLabel>
              <Select
                value={area.result || ""}
                onValueChange={(v) => field("result", v)}
              >
                <SelectTrigger
                  id={`${id}-result`}
                  className="w-full bg-background"
                >
                  <SelectValue placeholder="Select result" />
                </SelectTrigger>
                <SelectContent position="popper">
                  <SelectItem value="No finding">No finding</SelectItem>
                  <SelectItem value="Finding raised">Finding raised</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor={`${id}-date`}>
                {area.s === "Tested" ? "Tested on" : "Started on"}
              </FieldLabel>
              <Input
                id={`${id}-date`}
                type="date"
                className="bg-background"
                value={
                  (area.s === "Tested" ? area.testedAt : area.startedAt) || ""
                }
                onChange={(e) =>
                  field(
                    area.s === "Tested" ? "testedAt" : "startedAt",
                    e.target.value
                  )
                }
              />
            </Field>
            <Field>
              <FieldLabel htmlFor={`${id}-jira`}>Jira task</FieldLabel>
              <Input
                id={`${id}-jira`}
                className="bg-background font-mono"
                value={area.j || ""}
                onChange={(e) => field("j", e.target.value)}
                placeholder="SEC-123"
              />
            </Field>
            <Field className="sm:col-span-2">
              <FieldLabel htmlFor={`${id}-notes`}>
                Notes / blocker reason
              </FieldLabel>
              <Input
                id={`${id}-notes`}
                className="bg-background"
                value={area.notes || area.reason || ""}
                onChange={(e) => field("notes", e.target.value)}
                placeholder="Required when blocked or deferred"
              />
            </Field>
          </div>
        </CollapsibleContent>
      </li>
    </Collapsible>
  )
}

export function AreaList({ product }: { product: Product }) {
  const [filter, setFilter] = React.useState<"all" | AreaStatus | "priority">(
    "all"
  )
  const areas = (product.areas || []).map((area, index) => ({ area, index }))
  const shown = areas.filter(
    ({ area }) =>
      filter === "all" || (filter === "priority" ? area.hr : area.s === filter)
  )
  const filters: { value: typeof filter; label: string; count: number }[] = [
    { value: "all", label: "All", count: areas.length },
    {
      value: "priority",
      label: "High risk",
      count: areas.filter(({ area }) => area.hr).length,
    },
    ...AREA_STATUSES.map((s) => ({
      value: s,
      label: s,
      count: areas.filter(({ area }) => area.s === s).length,
    })),
  ]

  return (
    <div className="grid gap-4">
      <div
        className="flex flex-wrap gap-1.5"
        role="group"
        aria-label="Filter test areas"
      >
        {filters.map((f) => (
          <Button
            key={f.value}
            size="sm"
            variant={filter === f.value ? "default" : "secondary"}
            aria-pressed={filter === f.value}
            onClick={() => setFilter(f.value)}
            disabled={!f.count && f.value !== "all"}
          >
            {f.label}
            <span className="tabular opacity-70">{f.count}</span>
          </Button>
        ))}
      </div>
      <ul className="grid gap-0.5">
        {shown.map(({ area, index }) => (
          <AreaRow
            key={`${area.n}-${index}`}
            product={product}
            area={area}
            index={index}
          />
        ))}
      </ul>
      <p className="px-3 text-xs text-muted-foreground">
        Marking an area Tested needs a method and result; Blocked needs a
        reason. Time-box: change approach after 1 working day in testing, move
        on after 2.
      </p>
    </div>
  )
}
