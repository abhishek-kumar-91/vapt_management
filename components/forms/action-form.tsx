"use client"

import * as React from "react"
import { CircleAlertIcon, LoaderCircleIcon } from "lucide-react"

import { DevLink } from "@/components/auth/dev-link"
import { FormFields, type FieldSpec } from "@/components/forms/form-fields"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export type { FieldSpec } from "@/components/forms/form-fields"

/** What every server action behind a form returns. */
export type ActionFormState =
  | {
      error?: string
      fieldErrors?: Record<string, string>
      values?: Record<string, string>
      /** Development only: the link an email would carry. */
      devLink?: string
      done?: boolean
      /** A short success line (for edits that stay on the page). */
      notice?: string
    }
  | undefined

export type FormAction = (
  prev: ActionFormState,
  form: FormData
) => Promise<ActionFormState>

/** Shared result handling for forms and sheets: keeps answers after a refusal, resets on success. */
export function useFormAction(action: FormAction) {
  const [state, run, pending] = React.useActionState(action, undefined)
  // A new key per result: remounting restores the person's answers after a refusal (selects
  // included) and clears the fields after a success.
  const key = JSON.stringify(state ?? null)
  return { state, run, pending, key }
}

export function FormError({ message }: { message?: string }) {
  if (!message) return null
  return (
    <Alert variant="destructive" role="alert">
      <CircleAlertIcon />
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  )
}

export function SubmitButton({
  pending,
  label,
  pendingLabel,
  size = "default",
  form,
  className,
}: {
  pending: boolean
  label: string
  pendingLabel: string
  size?: "default" | "lg"
  form?: string
  className?: string
}) {
  return (
    <Button
      type="submit"
      form={form}
      disabled={pending}
      className={cn(size === "lg" && "h-11", className)}
    >
      {pending && (
        <LoaderCircleIcon className="animate-spin" data-icon="inline-start" />
      )}
      {pending ? pendingLabel : label}
    </Button>
  )
}

/**
 * An inline server-action form, for pages whose purpose is the form (sign-up, onboarding
 * steps, settings). Forms that add something to a list open in a FormSheet instead.
 */
export function ActionForm({
  action,
  fields,
  submitLabel,
  pendingLabel,
  doneMessage,
  honeypot = false,
  size = "default",
  className,
  children,
}: {
  action: FormAction
  fields: FieldSpec[]
  submitLabel: string
  pendingLabel: string
  /** Replaces the form once the action reports done. */
  doneMessage?: React.ReactNode
  /** Adds a hidden field only bots fill in. */
  honeypot?: boolean
  size?: "default" | "lg"
  className?: string
  children?: React.ReactNode
}) {
  const { state, run, pending, key } = useFormAction(action)
  const idPrefix = React.useId()

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
    <form action={run} noValidate className={cn("grid gap-6", className)}>
      <FormError message={state?.error} />
      <FormFields
        key={key}
        fields={fields}
        values={state?.values}
        errors={state?.fieldErrors}
        idPrefix={idPrefix}
        size={size}
      />
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
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton
          pending={pending}
          label={submitLabel}
          pendingLabel={pendingLabel}
          size={size}
          className="w-full sm:w-fit"
        />
        {state?.notice && (
          <p role="status" className="text-sm text-muted-foreground">
            {state.notice}
          </p>
        )}
      </div>
    </form>
  )
}
