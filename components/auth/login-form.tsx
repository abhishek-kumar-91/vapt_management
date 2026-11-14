"use client"

import * as React from "react"
import Link from "next/link"
import {
  ArrowRightIcon,
  CircleAlertIcon,
  EyeIcon,
  EyeOffIcon,
  InfoIcon,
  LoaderCircleIcon,
} from "lucide-react"

import { signIn } from "@/app/login/actions"
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
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"
import { EMAIL_PATTERN } from "@/lib/auth/shared"

export function LoginForm({ next, notice }: { next: string; notice?: string }) {
  const [state, formAction, pending] = React.useActionState(signIn, undefined)
  const [email, setEmail] = React.useState("")
  const [localErrors, setLocalErrors] = React.useState<{
    email?: string
    password?: string
  }>({})
  const [showPassword, setShowPassword] = React.useState(false)
  const [capsLock, setCapsLock] = React.useState(false)
  const passwordRef = React.useRef<HTMLInputElement>(null)

  // After a failed attempt React clears the (uncontrolled) password; put the caret back there.
  React.useEffect(() => {
    if (state?.error) passwordRef.current?.focus()
  }, [state])

  const errors = { ...state?.fieldErrors, ...localErrors }

  // Catch the obvious mistakes before a round trip; the server re-checks everything.
  const check = (event: React.FormEvent<HTMLFormElement>) => {
    const password = new FormData(event.currentTarget).get("password")
    const found = {
      email: EMAIL_PATTERN.test(email.trim())
        ? undefined
        : "Enter a valid work email, like name@company.com.",
      password: password ? undefined : "Enter your password.",
    }
    setLocalErrors(found)
    if (found.email || found.password) event.preventDefault()
  }

  const trackCaps = (event: React.KeyboardEvent) =>
    setCapsLock(event.getModifierState("CapsLock"))

  return (
    <form
      noValidate
      action={formAction}
      onSubmit={check}
      className="grid gap-6"
    >
      <input type="hidden" name="next" value={next} />

      {state?.error ? (
        <Alert variant="destructive" role="alert">
          <CircleAlertIcon />
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : (
        notice && (
          <p
            role="status"
            className="flex gap-2.5 rounded-3xl bg-muted px-4 py-3 text-sm text-muted-foreground"
          >
            <InfoIcon className="mt-0.5 size-4 shrink-0" />
            {notice}
          </p>
        )
      )}

      <FieldGroup className="gap-5">
        <Field data-invalid={!!errors.email || undefined}>
          <FieldLabel htmlFor="email">Work email</FieldLabel>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            autoFocus
            spellCheck={false}
            maxLength={254}
            placeholder="name@company.com"
            className="h-11 px-4"
            value={email}
            aria-invalid={!!errors.email || undefined}
            aria-describedby={errors.email ? "email-error" : undefined}
            onChange={(e) => {
              setEmail(e.target.value)
              if (localErrors.email)
                setLocalErrors((v) => ({ ...v, email: undefined }))
            }}
          />
          {errors.email && (
            <FieldError id="email-error">{errors.email}</FieldError>
          )}
        </Field>
        <Field data-invalid={!!errors.password || undefined}>
          <FieldLabel htmlFor="password">Password</FieldLabel>
          <InputGroup className="h-11">
            <InputGroupInput
              ref={passwordRef}
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              maxLength={128}
              className="px-4"
              aria-invalid={!!errors.password || undefined}
              aria-describedby={
                [errors.password && "password-error", capsLock && "caps-lock"]
                  .filter(Boolean)
                  .join(" ") || undefined
              }
              onKeyDown={trackCaps}
              onKeyUp={trackCaps}
              onBlur={() => setCapsLock(false)}
              onChange={() => {
                if (localErrors.password)
                  setLocalErrors((v) => ({ ...v, password: undefined }))
              }}
            />
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                size="icon-xs"
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
                onClick={() => setShowPassword((v) => !v)}
              >
                {showPassword ? <EyeOffIcon /> : <EyeIcon />}
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
          {errors.password && (
            <FieldError id="password-error">{errors.password}</FieldError>
          )}
          {capsLock && (
            <FieldDescription
              id="caps-lock"
              className="text-[color-mix(in_oklch,var(--warning),black_45%)] dark:text-warning"
            >
              Caps Lock is on.
            </FieldDescription>
          )}
        </Field>
      </FieldGroup>

      <Button
        type="submit"
        size="lg"
        className="h-11 w-full text-base"
        disabled={pending}
      >
        {pending ? (
          <>
            <LoaderCircleIcon
              className="animate-spin"
              data-icon="inline-start"
            />
            Signing in…
          </>
        ) : (
          <>
            Sign in
            <ArrowRightIcon data-icon="inline-end" />
          </>
        )}
      </Button>

      <div className="grid gap-1.5 text-center text-sm text-muted-foreground">
        <p>
          <Link
            href="/forgot-password"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            Forgot your password?
          </Link>
        </p>
        <p>
          New to Pentest Scout?{" "}
          <Link
            href="/signup"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Register your company
          </Link>
        </p>
      </div>
    </form>
  )
}
