"use client"

import * as React from "react"
import {
  CircleAlertIcon,
  EyeIcon,
  EyeOffIcon,
  LoaderCircleIcon,
  LockKeyholeIcon,
} from "lucide-react"

import { setPassword } from "@/app/set-password/[token]/actions"
import { ACCOUNT_SKIN } from "@/components/forms/form-fields"
import { cn } from "@/lib/utils"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"
import { PASSWORD_MAX, PASSWORD_MIN } from "@/lib/auth/password-rules"

export function SetPasswordForm({
  token,
  email,
}: {
  token: string
  email: string
}) {
  const [state, formAction, pending] = React.useActionState(
    setPassword.bind(null, token),
    undefined
  )
  const [show, setShow] = React.useState(false)
  const fieldError = state?.field ? state.error : undefined
  const formError = state?.field ? undefined : state?.error

  return (
    <form noValidate action={formAction} className="grid gap-6">
      {/* Lets password managers save the new password against the right account. */}
      <input
        type="text"
        name="username"
        autoComplete="username"
        value={email}
        readOnly
        hidden
      />

      {formError && (
        <Alert variant="destructive" role="alert">
          <CircleAlertIcon />
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      )}

      <FieldGroup className="gap-5">
        <Field data-invalid={state?.field === "password" || undefined}>
          <FieldLabel htmlFor="password">New password</FieldLabel>
          <InputGroup className={cn("h-11", ACCOUNT_SKIN)}>
            <InputGroupAddon className="pl-4 transition-colors duration-200 group-focus-within/input-group:text-foreground">
              <LockKeyholeIcon />
            </InputGroupAddon>
            <InputGroupInput
              id="password"
              name="password"
              type={show ? "text" : "password"}
              autoComplete="new-password"
              autoFocus
              required
              minLength={PASSWORD_MIN}
              maxLength={PASSWORD_MAX}
              placeholder="A long, memorable phrase"
              className="pr-4"
              aria-invalid={state?.field === "password" || undefined}
              aria-describedby="password-help"
            />
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                size="icon-xs"
                aria-label={show ? "Hide passwords" : "Show passwords"}
                aria-pressed={show}
                onClick={() => setShow((v) => !v)}
              >
                {show ? <EyeOffIcon /> : <EyeIcon />}
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
          {state?.field === "password" ? (
            <FieldError id="password-help">{fieldError}</FieldError>
          ) : (
            <FieldDescription id="password-help">
              At least {PASSWORD_MIN} characters. A short sentence is easy to
              remember and hard to guess.
            </FieldDescription>
          )}
        </Field>
        <Field data-invalid={state?.field === "confirm" || undefined}>
          <FieldLabel htmlFor="confirm">Confirm password</FieldLabel>
          <InputGroup className={cn("h-11", ACCOUNT_SKIN)}>
            <InputGroupAddon className="pl-4 transition-colors duration-200 group-focus-within/input-group:text-foreground">
              <LockKeyholeIcon />
            </InputGroupAddon>
            <InputGroupInput
              id="confirm"
              name="confirm"
              type={show ? "text" : "password"}
              autoComplete="new-password"
              required
              maxLength={PASSWORD_MAX}
              placeholder="Type it once more"
              className="pr-4"
              aria-invalid={state?.field === "confirm" || undefined}
              aria-describedby={
                state?.field === "confirm" ? "confirm-error" : undefined
              }
            />
          </InputGroup>
          {state?.field === "confirm" && (
            <FieldError id="confirm-error">{fieldError}</FieldError>
          )}
        </Field>
      </FieldGroup>

      <Button
        type="submit"
        size="lg"
        className="h-11 w-full text-base"
        disabled={pending}
      >
        {pending && (
          <LoaderCircleIcon className="animate-spin" data-icon="inline-start" />
        )}
        {pending ? "Saving…" : "Save password and sign in"}
      </Button>
    </form>
  )
}
