"use client"

import * as React from "react"
import { CircleAlertIcon, LoaderCircleIcon } from "lucide-react"

import { DevLink } from "@/components/auth/dev-link"
import type { ActionFormState } from "@/components/forms/action-form"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"

/** One button that runs a server action, with its pending state, error and (dev) link. */
export function ActionButton({
  action,
  label,
  pendingLabel,
  doneMessage,
  variant = "default",
  size = "lg",
}: {
  action: () => Promise<ActionFormState>
  label: string
  pendingLabel: string
  /** Shown after a successful run that doesn't navigate away. */
  doneMessage?: string
  variant?: "default" | "outline" | "ghost"
  /** "sm" for inline row actions. */
  size?: "lg" | "sm"
}) {
  const [state, run, pending] = React.useActionState(action, undefined)
  return (
    <form action={run} className={size === "sm" ? "grid justify-items-end gap-2" : "grid gap-4"}>
      {state?.error && (
        <Alert variant="destructive" role="alert">
          <CircleAlertIcon />
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}
      {state?.done && doneMessage && (
        <p role="status" className="text-sm text-muted-foreground">
          {doneMessage}
        </p>
      )}
      <DevLink href={state?.devLink} />
      <Button
        type="submit"
        variant={variant}
        size={size === "sm" ? "sm" : "default"}
        className={size === "sm" ? "w-fit" : "h-11 w-fit"}
        disabled={pending}
      >
        {pending && <LoaderCircleIcon className="animate-spin" />}
        {pending ? pendingLabel : label}
      </Button>
    </form>
  )
}
