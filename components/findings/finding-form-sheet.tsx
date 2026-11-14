"use client"

import * as React from "react"
import { AlertTriangleIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field"
import { DatePicker } from "@/components/ui/date-picker"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import { useDashboard } from "@/lib/store"
import { SEVERITIES } from "@/lib/sop"
import type { NewFindingValues, Product, Severity } from "@/lib/types"

const LATE_CAUSES = [
  "Code changed",
  "New method",
  "Missed check",
  "New knowledge",
]

function initialValues(product?: Product): NewFindingValues {
  const first = product?.areas?.[0]
  return {
    title: "",
    affectedFeature: first?.n || "",
    foundWhile: first?.n || "",
    relatedTask: first?.j || "",
    severity: "Medium",
    cvss: "",
    description: "",
    steps: "",
    impact: "",
    evidence: "",
    environment: "",
    reference: "",
    recommendation: "",
    late: false,
    previousTest: "",
    discoveryMethod: "",
    lateCause: "New method",
    targetRelease: "",
    exploitationSuspected: false,
  }
}

function SelectField({
  id,
  label,
  value,
  onChange,
  options,
  required,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
  required?: boolean
}) {
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Select value={value} onValueChange={onChange} required={required}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue placeholder="Select…" />
        </SelectTrigger>
        <SelectContent position="popper">
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  )
}

export function FindingFormSheet({
  open,
  onOpenChange,
  productId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Fixed product (product page). When omitted the form asks for one. */
  productId?: string
}) {
  const { products } = useDashboard()
  const [selectedId, setSelectedId] = React.useState(productId ?? "")
  const product = products.find((p) => p.id === (productId ?? selectedId))

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="gap-0 outline-none data-[side=right]:w-full sm:data-[side=right]:inset-y-2 sm:data-[side=right]:right-2 sm:data-[side=right]:h-auto data-[side=right]:sm:max-w-2xl sm:data-[side=right]:rounded-4xl sm:data-[side=right]:border">
        <SheetHeader className="border-b px-6 py-5">
          <SheetTitle className="text-lg">
            Report a validated finding
          </SheetTitle>
          <SheetDescription>
            SOP §8 vulnerability ticket. Critical/High findings are escalated
            the same day.
          </SheetDescription>
        </SheetHeader>
        {/* Keyed so the form resets when the product changes; the sheet unmounts it on close. */}
        <FindingForm
          key={product?.id ?? "none"}
          product={product}
          productPicker={
            productId ? null : (
              <SelectField
                id="f-product"
                label="Product"
                required
                value={selectedId}
                onChange={setSelectedId}
                options={products.map((p) => ({ value: p.id, label: p.name }))}
              />
            )
          }
          onDone={() => onOpenChange(false)}
        />
      </SheetContent>
    </Sheet>
  )
}

function FindingForm({
  product,
  productPicker,
  onDone,
}: {
  product?: Product
  productPicker: React.ReactNode
  onDone: () => void
}) {
  const { actions } = useDashboard()
  const [values, setValues] = React.useState<NewFindingValues>(() =>
    initialValues(product)
  )

  const set = <K extends keyof NewFindingValues>(
    key: K,
    value: NewFindingValues[K]
  ) => setValues((current) => ({ ...current, [key]: value }))
  const areaOptions = (product?.areas || []).map((area) => ({
    value: area.n,
    label: area.n,
  }))

  // `required` accepts spaces; refuse blank-looking answers with a message the browser shows inline.
  const change =
    (key: keyof NewFindingValues) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const { value } = event.target
      event.target.setCustomValidity(
        value && !value.trim() ? "Enter more than spaces." : ""
      )
      set(key, value as never)
    }

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!product) return
    actions.addFinding(product.id, values)
    onDone()
  }

  const text = (
    key: keyof NewFindingValues,
    label: string,
    props: React.ComponentProps<typeof Input> = {}
  ) => (
    <Field>
      <FieldLabel htmlFor={`f-${key}`}>{label}</FieldLabel>
      <Input
        id={`f-${key}`}
        required
        value={String(values[key] ?? "")}
        onChange={change(key)}
        {...props}
      />
    </Field>
  )
  const area = (
    key: keyof NewFindingValues,
    label: string,
    placeholder?: string,
    rows = 3
  ) => (
    <Field>
      <FieldLabel htmlFor={`f-${key}`}>{label}</FieldLabel>
      <Textarea
        id={`f-${key}`}
        required
        rows={rows}
        className="min-h-20"
        placeholder={placeholder}
        value={String(values[key] ?? "")}
        onChange={change(key)}
      />
    </Field>
  )

  return (
    <>
      <form
        id="finding-form"
        onSubmit={submit}
        className="flex-1 overflow-y-auto px-6 py-6"
      >
        <FieldGroup>
          {productPicker}

          {product ? (
            <>
              <FieldSet>
                <FieldLegend>Classification</FieldLegend>
                <FieldGroup className="gap-5">
                  {text("title", "Finding title", {
                    maxLength: 200,
                    placeholder: "Vulnerability name",
                  })}
                  <div className="grid gap-5 sm:grid-cols-2">
                    <SelectField
                      id="f-affected"
                      label="Affected feature"
                      value={values.affectedFeature}
                      onChange={(v) => {
                        set("affectedFeature", v)
                        set(
                          "relatedTask",
                          product.areas.find((a) => a.n === v)?.j || ""
                        )
                      }}
                      options={areaOptions}
                    />
                    <SelectField
                      id="f-foundwhile"
                      label="Found while testing"
                      value={values.foundWhile}
                      onChange={(v) => set("foundWhile", v)}
                      options={areaOptions}
                    />
                    <SelectField
                      id="f-severity"
                      label="Severity"
                      value={values.severity}
                      onChange={(v) => set("severity", v as Severity)}
                      options={SEVERITIES.map((s) => ({ value: s, label: s }))}
                    />
                    {values.severity === "Low" ? (
                      <Field>
                        <FieldLabel htmlFor="f-targetRelease">
                          Target release date
                        </FieldLabel>
                        <DatePicker
                          id="f-targetRelease"
                          value={values.targetRelease}
                          onChange={(v) => set("targetRelease", v)}
                        />
                      </Field>
                    ) : (
                      text("relatedTask", "Linked test task", {
                        placeholder: "SEC-123",
                      })
                    )}
                    {values.severity === "Low" &&
                      text("relatedTask", "Linked test task", {
                        placeholder: "SEC-123",
                      })}
                    {text("cvss", "CVSS vector", {
                      placeholder: "CVSS:3.1/AV:N/…",
                    })}
                    {text("reference", "CWE or OWASP reference", {
                      placeholder: "CWE-862 / OWASP API1:2023",
                    })}
                  </div>
                  {text("environment", "Test environment", {
                    placeholder: "Approved staging / production environment",
                  })}
                </FieldGroup>
              </FieldSet>

              <FieldSet>
                <FieldLegend>Report</FieldLegend>
                <FieldGroup className="gap-5">
                  {area("description", "Description", undefined, 2)}
                  {area("steps", "Steps to reproduce", "1. …", 4)}
                  {area("impact", "Impact", undefined, 2)}
                  {area(
                    "evidence",
                    "Redacted evidence",
                    "Reference securely stored evidence. Never enter credentials or customer data.",
                    2
                  )}
                  {area("recommendation", "Recommendation", undefined, 2)}
                </FieldGroup>
              </FieldSet>

              <FieldSet>
                <FieldLegend>Flags</FieldLegend>
                <FieldGroup className="gap-4">
                  <Field orientation="horizontal">
                    <Checkbox
                      id="f-late"
                      checked={values.late}
                      onCheckedChange={(c) => set("late", c === true)}
                    />
                    <FieldLabel htmlFor="f-late" className="font-normal">
                      Late finding in an area previously tested
                    </FieldLabel>
                  </Field>
                  {values.late && (
                    <div className="grid gap-5 rounded-3xl bg-muted/60 p-4 sm:grid-cols-2">
                      <Field>
                        <FieldLabel htmlFor="f-previousTest">
                          Previously tested on
                        </FieldLabel>
                        <DatePicker
                          id="f-previousTest"
                          required
                          value={values.previousTest}
                          onChange={(v) => set("previousTest", v)}
                        />
                      </Field>
                      <SelectField
                        id="f-lateCause"
                        label="Late-finding cause"
                        value={values.lateCause}
                        onChange={(v) => set("lateCause", v)}
                        options={LATE_CAUSES.map((c) => ({
                          value: c,
                          label: c,
                        }))}
                      />
                      <div className="sm:col-span-2">
                        {text("discoveryMethod", "Discovery method / change")}
                      </div>
                    </div>
                  )}
                  <Field orientation="horizontal">
                    <Checkbox
                      id="f-exploit"
                      checked={values.exploitationSuspected}
                      onCheckedChange={(c) =>
                        set("exploitationSuspected", c === true)
                      }
                    />
                    <FieldLabel htmlFor="f-exploit" className="font-normal">
                      Possible exploitation in production. Escalate immediately
                      as a security incident.
                    </FieldLabel>
                  </Field>
                  {values.exploitationSuspected && (
                    <p className="flex gap-2 rounded-3xl bg-critical/10 p-3 text-sm text-critical">
                      <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" />
                      An incident event will be logged. Notify the Manager and
                      development lead now.
                    </p>
                  )}
                </FieldGroup>
              </FieldSet>

              <FieldDescription>
                Fix deadlines: Critical 7 days, High 30 days, Medium 90 days,
                Low by next release.
              </FieldDescription>
            </>
          ) : (
            <FieldDescription>
              Choose the product this finding belongs to.
            </FieldDescription>
          )}
        </FieldGroup>
      </form>

      <SheetFooter className="flex-row justify-end border-t px-6 py-4">
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" form="finding-form" disabled={!product}>
          Create finding report
        </Button>
      </SheetFooter>
    </>
  )
}
