"use client"

import * as React from "react"
import { CircleAlertIcon, LoaderCircleIcon } from "lucide-react"

import { DevLink } from "@/components/auth/dev-link"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

export type ActionFormState =
  | {
      error?: string
      fieldErrors?: Record<string, string>
      values?: Record<string, string>
      devLink?: string
      done?: boolean
      /** A short success line shown above the button (for edits that stay on the page). */
      notice?: string
    }
  | undefined

export interface FieldSpec {
  name: string
  label: string
  type?: "text" | "email" | "password" | "url" | "date" | "select" | "textarea"
  options?: readonly { value: string; label: string }[]
  autoComplete?: string
  placeholder?: string
  description?: string
  defaultValue?: string
  maxLength?: number
  /** Lays two short fields side by side on wide screens. */
  half?: boolean
}

const selectClass =
  "h-11 w-full rounded-2xl border border-input bg-transparent px-3 text-sm outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 aria-invalid:border-destructive"

/**
 * A server-action form from a list of fields: keeps typed values after a refusal, shows field and
 * form errors from the server, a pending state, and (development only) the emailed link.
 */
export function ActionForm({
  action,
  fields,
  submitLabel,
  pendingLabel,
  doneMessage,
  honeypot = false,
  className,
  children,
}: {
  action: (prev: ActionFormState, form: FormData) => Promise<ActionFormState>
  fields: FieldSpec[]
  submitLabel: string
  pendingLabel: string
  /** Replaces the form once the action reports done. */
  doneMessage?: React.ReactNode
  /** Adds a hidden field only bots fill in. */
  honeypot?: boolean
  className?: string
  children?: React.ReactNode
}) {
  const [state, run, pending] = React.useActionState(action, undefined)

  if (state?.done && doneMessage)
    return (
      <div className="grid gap-4">
        <p role="status" className="text-pretty text-muted-foreground">
          {doneMessage}
        </p>
        <DevLink href={state.devLink} />
      </div>
    )

  return (
    // Keyed by the returned values: React resets a form after its action runs, and a remount is
    // what puts the person's answers back into selects as well as inputs.
    <form
      key={JSON.stringify(state?.values ?? null)}
      action={run}
      noValidate
      className={cn("grid gap-6", className)}
    >
      {state?.error && (
        <Alert variant="destructive" role="alert">
          <CircleAlertIcon />
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}
      <FieldGroup className="grid gap-5 sm:grid-cols-2">
        {fields.map((f) => {
          const error = state?.fieldErrors?.[f.name]
          const value = state?.values?.[f.name] ?? f.defaultValue ?? ""
          const id = `f-${f.name}`
          const common = {
            id,
            name: f.name,
            "aria-invalid": !!error || undefined,
            "aria-describedby": f.description ? `${id}-desc` : undefined,
          }
          return (
            <Field
              key={f.name}
              data-invalid={!!error || undefined}
              className={f.half ? undefined : "sm:col-span-2"}
            >
              <FieldLabel htmlFor={id}>{f.label}</FieldLabel>
              {f.type === "select" ? (
                <select {...common} defaultValue={value} className={selectClass}>
                  {f.options?.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              ) : f.type === "textarea" ? (
                <Textarea
                  {...common}
                  defaultValue={value}
                  maxLength={f.maxLength}
                  placeholder={f.placeholder}
                  className="min-h-24"
                />
              ) : (
                <Input
                  {...common}
                  type={f.type ?? "text"}
                  defaultValue={f.type === "password" ? undefined : value}
                  autoComplete={f.autoComplete}
                  placeholder={f.placeholder}
                  maxLength={f.maxLength}
                  spellCheck={f.type === "email" || f.type === "url" ? false : undefined}
                  className="h-11"
                />
              )}
              {f.description && !error && (
                <FieldDescription id={`${id}-desc`}>{f.description}</FieldDescription>
              )}
              {error && <FieldError>{error}</FieldError>}
            </Field>
          )
        })}
      </FieldGroup>
      {honeypot && (
        <input
          type="text"
          name="contact_me"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden
          className="absolute -left-[9999px] size-px opacity-0"
        />
      )}
      {children}
      {state?.notice && (
        <p role="status" className="text-sm text-muted-foreground">
          {state.notice}
        </p>
      )}
      <Button type="submit" className="h-11 w-full sm:w-fit" disabled={pending}>
        {pending && <LoaderCircleIcon className="animate-spin" />}
        {pending ? pendingLabel : submitLabel}
      </Button>
    </form>
  )
}
