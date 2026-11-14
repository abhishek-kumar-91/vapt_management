"use client"

import * as React from "react"
import { ArchiveIcon, DownloadIcon, FileTextIcon } from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { ToneBadge } from "@/components/status"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { DatePicker } from "@/components/ui/date-picker"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { formatDate, LONG_DATE, todayIso } from "@/lib/dates"
import {
  buildReport,
  downloadText,
  REPORT_TYPES,
  type ReportForm,
} from "@/lib/reports"
import { useDashboard } from "@/lib/store"
import type { ReportType } from "@/lib/types"

export default function ReportsPage() {
  const { data, products, findings, actions } = useDashboard()
  const [type, setType] = React.useState<ReportType>("daily")
  const [form, setForm] = React.useState<ReportForm>(() => ({
    date: todayIso(),
    productId: "",
    tested: "",
    methods: "",
    findingNotes: "",
    blocked: "",
    tomorrow: "",
    lessons: "",
    resources: "",
    manager: "",
  }))
  const set = (key: keyof ReportForm, value: string) =>
    setForm((current) => ({ ...current, [key]: value }))
  const report = React.useMemo(
    () => buildReport(data, type, form, products, findings),
    [data, type, form, products, findings]
  )
  const saved = [...(data.reports || [])].reverse()
  const closeoutProduct = form.productId || products[0]?.id || ""

  const changeType = (value: string) => {
    setType(value as ReportType)
    if (value === "closeout" && !form.productId)
      set("productId", products[0]?.id || "")
  }

  const save = () =>
    actions.saveReport({
      id: `report-${Date.now()}`,
      type,
      date: form.date,
      title: REPORT_TYPES.find((r) => r.value === type)!.archiveTitle,
      body: report,
      productId:
        type === "closeout"
          ? closeoutProduct
          : type === "daily"
            ? form.productId
            : undefined,
    })

  const input = (
    key: keyof ReportForm,
    label: string,
    placeholder?: string
  ) => (
    <Field>
      <FieldLabel htmlFor={`r-${key}`}>{label}</FieldLabel>
      <Input
        id={`r-${key}`}
        value={form[key]}
        placeholder={placeholder}
        onChange={(e) => set(key, e.target.value)}
      />
    </Field>
  )

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Reports"
        description="Generate SOP §10 & §17 reports straight from the current tracker records."
        actions={<ToneBadge tone="neutral">{saved.length} saved</ToneBadge>}
      />

      <Tabs value={type} onValueChange={changeType} controls="report-workspace">
        <TabsList className="max-w-full justify-start overflow-x-auto">
          {REPORT_TYPES.map((r) => (
            <TabsTrigger key={r.value} value={r.value}>
              {r.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div
        id="report-workspace"
        className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]"
      >
        <Card>
          <CardHeader>
            <CardTitle>Inputs</CardTitle>
            <CardDescription>
              Anything left blank is reported as “not recorded”.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup className="gap-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="r-date">Report date</FieldLabel>
                  <DatePicker
                    id="r-date"
                    value={form.date}
                    onChange={(v) => set("date", v)}
                  />
                </Field>
                {(type === "daily" || type === "closeout") && (
                  <Field>
                    <FieldLabel htmlFor="r-product">
                      {type === "daily" ? "Target product" : "Product"}
                    </FieldLabel>
                    <Select
                      value={
                        type === "closeout"
                          ? closeoutProduct
                          : form.productId || "portfolio"
                      }
                      onValueChange={(v) =>
                        set("productId", v === "portfolio" ? "" : v)
                      }
                    >
                      <SelectTrigger id="r-product" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent position="popper">
                        {type === "daily" && (
                          <SelectItem value="portfolio">
                            Portfolio-wide
                          </SelectItem>
                        )}
                        {products.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                )}
              </div>
              {type === "daily" ? (
                <>
                  {input(
                    "tested",
                    "Features / checklist areas tested",
                    "Product, feature and area counts"
                  )}
                  {input("methods", "Methods used", "Methods, roles and tools")}
                  <div className="grid gap-5 sm:grid-cols-2">
                    {input("findingNotes", "Finding notes")}
                    {input("blocked", "Blockers")}
                  </div>
                  {input("tomorrow", "Tomorrow’s plan")}
                </>
              ) : (
                <>
                  <Field>
                    <FieldLabel htmlFor="r-lessons">
                      {type === "monthly"
                        ? "Lessons learned and SOP improvements"
                        : type === "closeout"
                          ? "Recommendations and residual risk"
                          : "Blockers and risks"}
                    </FieldLabel>
                    <Textarea
                      id="r-lessons"
                      rows={3}
                      value={form.lessons}
                      onChange={(e) => set("lessons", e.target.value)}
                    />
                  </Field>
                  <div className="grid gap-5 sm:grid-cols-2">
                    {input("blocked", "Blockers / reason")}
                    {input("tomorrow", "Next period plan")}
                    {type === "monthly" && input("resources", "Resource needs")}
                    {type === "monthly" &&
                      input("manager", "Requests to Manager")}
                  </div>
                </>
              )}
            </FieldGroup>
          </CardContent>
        </Card>

        <Card className="xl:sticky xl:top-20">
          <CardHeader>
            <CardTitle>Live preview</CardTitle>
            <CardDescription>
              Calculated from current product, finding and event data
            </CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="max-h-[32rem] overflow-auto rounded-3xl bg-muted/70 p-5 font-mono text-xs leading-relaxed whitespace-pre-wrap text-foreground/85">
              {report}
            </pre>
          </CardContent>
          <CardFooter className="justify-end gap-2">
            <Button
              variant="outline"
              onClick={() =>
                downloadText(report, `vapt-${type}-${form.date}.md`)
              }
            >
              <DownloadIcon data-icon="inline-start" />
              Download .md
            </Button>
            <Button onClick={save}>
              <ArchiveIcon data-icon="inline-start" />
              Save to archive
            </Button>
          </CardFooter>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Saved reports</CardTitle>
          <CardDescription>Stored in this browser’s archive</CardDescription>
        </CardHeader>
        <CardContent className="px-3">
          {saved.length ? (
            <ul className="grid gap-0.5">
              {saved.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center gap-3 rounded-3xl px-3 py-2.5 hover:bg-muted/60"
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                    <FileTextIcon className="size-4" />
                  </span>
                  <span className="grid min-w-0 flex-1 gap-0.5">
                    <span className="truncate text-sm font-medium">
                      {item.title}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(item.date, LONG_DATE)}
                    </span>
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      downloadText(
                        item.body,
                        `vapt-${item.type}-${item.date}.md`
                      )
                    }
                  >
                    <DownloadIcon data-icon="inline-start" />
                    Download
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-3 py-6 text-sm text-muted-foreground">
              No saved reports yet. Saving a weekly report also records a
              coverage snapshot for the trend chart.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
