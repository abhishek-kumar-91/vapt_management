"use client"

import { InfoIcon, TriangleAlertIcon } from "lucide-react"

import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { meetsCloseoutCriteria, type ProductMetrics } from "@/lib/metrics"
import { PRODUCT_STATUSES } from "@/lib/sop"
import { useDashboard } from "@/lib/store"
import type { Product, ProductRecord, ProductStatus, Tier } from "@/lib/types"

function Notice({
  tone,
  children,
}: {
  tone: "info" | "warning"
  children: React.ReactNode
}) {
  const Icon = tone === "info" ? InfoIcon : TriangleAlertIcon
  return (
    <p
      className={
        tone === "info"
          ? "flex gap-2.5 rounded-3xl bg-primary/8 px-4 py-3 text-sm text-foreground"
          : "flex gap-2.5 rounded-3xl bg-warning/15 px-4 py-3 text-sm text-[color-mix(in_oklch,var(--warning),black_50%)] dark:text-warning"
      }
    >
      <Icon className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </p>
  )
}

export function ProductRegister({
  product,
  metrics,
}: {
  product: Product
  metrics: ProductMetrics
}) {
  const { actions } = useDashboard()
  const set = <K extends keyof ProductRecord>(
    field: K,
    value: ProductRecord[K]
  ) => actions.updateProduct(product.id, field, value)
  const baselineReady =
    !!product.closeout && meetsCloseoutCriteria(product, metrics)
  const input = (
    field: keyof ProductRecord,
    label: string,
    props: React.ComponentProps<typeof Input> = {}
  ) => (
    <Field>
      <FieldLabel htmlFor={`reg-${field}`}>{label}</FieldLabel>
      <Input
        id={`reg-${field}`}
        value={String(product[field] ?? "")}
        onChange={(e) =>
          set(
            field,
            (props.type === "number"
              ? Number(e.target.value)
              : e.target.value) as never
          )
        }
        {...props}
      />
    </Field>
  )

  return (
    <div className="grid gap-6">
      {product.status === "In progress" && (
        <Notice tone="info">
          <strong className="font-medium">Plan vs actual:</strong>{" "}
          {metrics.elapsedWorkdays} / {product.estDays || 7} working days
          elapsed · planned {metrics.planned}% · actual {metrics.coverage}% ·{" "}
          {metrics.behind}% behind.
        </Notice>
      )}
      {product.status === "In progress" &&
        metrics.priorityCoverage === 100 &&
        metrics.coverage >= 80 &&
        !product.closeout && (
          <Notice tone="warning">
            <strong className="font-medium">Baseline nearly complete.</strong>{" "}
            Enter the close-out report date before changing status to Baseline
            complete.
          </Notice>
        )}
      {product.status === "Baseline complete" && !baselineReady && (
        <Notice tone="warning">
          <strong className="font-medium">
            Baseline completion criteria not met.
          </strong>{" "}
          Requires 100% priority coverage, at least 80% overall, and a close-out
          report date.
        </Notice>
      )}

      <FieldGroup className="gap-5">
        <Field>
          <FieldLabel htmlFor="reg-switchReason">
            Manager-approved reason / handover
          </FieldLabel>
          <Input
            id="reg-switchReason"
            value={product.switchReason || ""}
            onChange={(e) => set("switchReason", e.target.value)}
            placeholder="Include handover notes and coverage at the switch"
          />
          <FieldDescription>
            Required before changing the baseline status. It is logged with the
            change.
          </FieldDescription>
        </Field>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <Field>
            <FieldLabel htmlFor="reg-status">Baseline status</FieldLabel>
            <Select
              value={product.status || "Not started"}
              onValueChange={(v) => set("status", v as ProductStatus)}
            >
              <SelectTrigger id="reg-status" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper">
                {PRODUCT_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor="reg-tier">Risk tier</FieldLabel>
            <Select
              value={String(product.tier || 2)}
              onValueChange={(v) => set("tier", Number(v) as Tier)}
            >
              <SelectTrigger id="reg-tier" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper">
                <SelectItem value="1">Tier 1 (highest)</SelectItem>
                <SelectItem value="2">Tier 2</SelectItem>
                <SelectItem value="3">Tier 3</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {input("estDays", "Estimated working days", {
            type: "number",
            min: 1,
            max: 90,
          })}
          {input("baselineStart", "Baseline start", { type: "date" })}
          {input("closeout", "Close-out report date", { type: "date" })}
          {input("lastTested", "Last tested", { type: "date" })}
          {product.status === "Paused" &&
            input("resumeOn", "Manager-approved resume date", { type: "date" })}
          {input("technology", "Technology stack", {
            placeholder: "Web / API / mobile / cloud",
          })}
          {input("dataSensitivity", "Data sensitivity", {
            placeholder: "Customer / payments / internal",
          })}
        </div>
      </FieldGroup>
    </div>
  )
}
