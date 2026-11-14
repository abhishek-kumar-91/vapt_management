"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  ArrowRightIcon,
  EyeIcon,
  EyeOffIcon,
  InfoIcon,
  LoaderCircleIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Field,
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

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function LoginForm() {
  const router = useRouter()
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [showPassword, setShowPassword] = React.useState(false)
  const [submitted, setSubmitted] = React.useState(false)
  const [pending, startTransition] = React.useTransition()

  const emailError =
    submitted && !EMAIL.test(email.trim())
      ? "Enter a valid work email, like name@company.com."
      : ""
  const passwordError = submitted && !password ? "Enter your password." : ""

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    setSubmitted(true)
    if (!EMAIL.test(email.trim()) || !password) return
    // ponytail: no identity provider yet; any valid-looking credentials open the dashboard. Wire real auth here.
    startTransition(() => router.push("/dashboard"))
  }

  return (
    <form noValidate onSubmit={submit} className="grid gap-6">
      <FieldGroup className="gap-5">
        <Field data-invalid={!!emailError || undefined}>
          <FieldLabel htmlFor="email">Work email</FieldLabel>
          <Input
            id="email"
            type="email"
            autoComplete="username"
            autoFocus
            placeholder="name@company.com"
            className="h-11 px-4"
            value={email}
            aria-invalid={!!emailError || undefined}
            onChange={(e) => setEmail(e.target.value)}
          />
          {emailError && <FieldError>{emailError}</FieldError>}
        </Field>
        <Field data-invalid={!!passwordError || undefined}>
          <FieldLabel htmlFor="password">Password</FieldLabel>
          <InputGroup className="h-11">
            <InputGroupInput
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              className="px-4"
              value={password}
              aria-invalid={!!passwordError || undefined}
              onChange={(e) => setPassword(e.target.value)}
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
          {passwordError && <FieldError>{passwordError}</FieldError>}
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
            Opening console…
          </>
        ) : (
          <>
            Sign in
            <ArrowRightIcon data-icon="inline-end" />
          </>
        )}
      </Button>

      <p className="flex gap-2.5 rounded-3xl bg-muted px-4 py-3 text-sm text-muted-foreground">
        <InfoIcon className="mt-0.5 size-4 shrink-0" />
        <span>
          Sample environment: sign-in isn’t connected to an identity provider
          yet, so any work email and password opens the dashboard.
        </span>
      </p>
    </form>
  )
}
