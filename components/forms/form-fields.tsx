"use client"

import * as React from "react"

import { DatePicker } from "@/components/ui/date-picker"
import {
  Field,
  FieldDescription,
  FieldError,
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
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

/** One field of a server-action form. Every form in the app is described this way. */
export interface FieldSpec {
  name: string
  label: string
  type?: "text" | "email" | "password" | "url" | "date" | "select" | "textarea"
  /** For selects. An option with value "" is the "nothing chosen" choice. */
  options?: readonly { value: string; label: string; description?: string }[]
  autoComplete?: string
  placeholder?: string
  description?: string
  defaultValue?: string
  maxLength?: number
  required?: boolean
  /** Marks the label "Optional". */
  optional?: boolean
  /** Two short fields side by side on wider screens. */
  half?: boolean
}

/** Radix Select can't hold "" as an item value; it stands in for "nothing chosen". */
const NONE = "__none__"

/**
 * Renders a list of FieldSpecs with the design-system controls (Select, DatePicker, Textarea,
 * Input), each labelled, described and wired to its error for screen readers. Values travel in
 * the form's FormData under each field's `name`, so any server action can read them.
 */
export function FormFields({
  fields,
  values,
  errors,
  idPrefix,
  size = "default",
}: {
  fields: readonly FieldSpec[]
  /** Values to start from (or to restore after a refusal). */
  values?: Record<string, string>
  errors?: Record<string, string>
  /** Keeps ids unique when two forms share a page. */
  idPrefix: string
  /** "lg" for the standalone account pages, which use taller controls. */
  size?: "default" | "lg"
}) {
  return (
    <FieldGroup className="grid gap-5 sm:grid-cols-2">
      {fields.map((f) => (
        <FieldControl
          key={f.name}
          field={f}
          id={`${idPrefix}-${f.name}`}
          initial={values?.[f.name] ?? f.defaultValue ?? ""}
          error={errors?.[f.name]}
          size={size}
        />
      ))}
    </FieldGroup>
  )
}

function FieldControl({
  field: f,
  id,
  initial,
  error,
  size,
}: {
  field: FieldSpec
  id: string
  initial: string
  error?: string
  size: "default" | "lg"
}) {
  const [value, setValue] = React.useState(initial)
  const describedBy =
    [error ? `${id}-error` : "", f.description ? `${id}-desc` : ""]
      .filter(Boolean)
      .join(" ") || undefined
  const a11y = {
    id,
    "aria-invalid": !!error || undefined,
    "aria-describedby": describedBy,
    "aria-required": f.required || undefined,
  }
  const tall = size === "lg" ? "h-11" : undefined

  let control: React.ReactNode
  if (f.type === "select") {
    const options = f.options ?? []
    const placeholder = options.find((o) => o.value === "")?.label ?? "Choose one"
    control = (
      <Select
        value={value === "" ? (f.required ? "" : NONE) : value}
        onValueChange={(v) => setValue(v === NONE ? "" : v)}
      >
        <SelectTrigger {...a11y} className={cn("w-full", tall)}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options
            // A required select shows "" only as its placeholder, never as a choice.
            .filter((o) => !(f.required && o.value === ""))
            .map((o) => (
              <SelectItem key={o.value || NONE} value={o.value || NONE}>
                {o.label}
              </SelectItem>
            ))}
        </SelectContent>
      </Select>
    )
    control = (
      <>
        {control}
        <input type="hidden" name={f.name} value={value} />
      </>
    )
  } else if (f.type === "date") {
    control = (
      <>
        <DatePicker
          {...a11y}
          value={value}
          onChange={setValue}
          placeholder={f.placeholder ?? "Pick a date"}
          className={tall}
        />
        <input type="hidden" name={f.name} value={value} />
      </>
    )
  } else if (f.type === "textarea") {
    control = (
      <Textarea
        {...a11y}
        name={f.name}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        maxLength={f.maxLength}
        placeholder={f.placeholder}
        className="min-h-24"
      />
    )
  } else {
    control = (
      <Input
        {...a11y}
        name={f.name}
        type={f.type ?? "text"}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        autoComplete={f.autoComplete}
        placeholder={f.placeholder}
        maxLength={f.maxLength}
        spellCheck={f.type === "email" || f.type === "url" ? false : undefined}
        className={tall}
      />
    )
  }

  return (
    <Field
      data-invalid={!!error || undefined}
      className={f.half ? undefined : "sm:col-span-2"}
    >
      <FieldLabel htmlFor={id}>
        {f.label}
        {f.optional && (
          <span className="font-normal text-muted-foreground">Optional</span>
        )}
      </FieldLabel>
      {control}
      {f.description && (
        <FieldDescription id={`${id}-desc`}>{f.description}</FieldDescription>
      )}
      {error && <FieldError id={`${id}-error`}>{error}</FieldError>}
    </Field>
  )
}
