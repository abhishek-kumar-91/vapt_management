"use client"

import * as React from "react"
import { InfoIcon, LoaderCircleIcon } from "lucide-react"
import { toast } from "sonner"

import {
  inviteUserAction,
  updateUserAction,
} from "@/app/dashboard/users/actions"
import { useCurrentUser } from "@/components/current-user"
import type { AccessLink } from "@/components/users/access-link-dialog"
import { useUsersMutation } from "@/components/users/queries"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  MANAGEABLE_ROLES,
  ROLE_LABELS,
  ROLE_SUMMARIES,
  type Role,
} from "@/lib/auth/roles"
import { EMAIL, type TeamUser } from "@/lib/users"
import { cn } from "@/lib/utils"

/** Invite a new user (no `user`) or edit an existing one's name, email and role. */
export function UserFormSheet({
  open,
  onOpenChange,
  user,
  onInvited,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  user?: TeamUser
  onInvited: (link: AccessLink) => void
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="gap-0 outline-none data-[side=right]:w-full sm:data-[side=right]:inset-y-2 sm:data-[side=right]:right-2 sm:data-[side=right]:h-auto data-[side=right]:sm:max-w-lg sm:data-[side=right]:rounded-4xl sm:data-[side=right]:border">
        <SheetHeader className="border-b px-6 py-5">
          <SheetTitle className="text-lg">
            {user ? `Edit ${user.name}` : "Invite a user"}
          </SheetTitle>
          <SheetDescription>
            {user
              ? "Update their details or change what they’re allowed to do."
              : "You’ll get a one-time link to send them. They choose their own password."}
          </SheetDescription>
        </SheetHeader>
        {/* Keyed so the form resets between users; the sheet unmounts it on close. */}
        <UserForm
          key={user?.id ?? "new"}
          user={user}
          onDone={() => onOpenChange(false)}
          onInvited={onInvited}
        />
      </SheetContent>
    </Sheet>
  )
}

interface Values {
  name: string
  email: string
  role: Role
}

function UserForm({
  user,
  onDone,
  onInvited,
}: {
  user?: TeamUser
  onDone: () => void
  onInvited: (link: AccessLink) => void
}) {
  const me = useCurrentUser()
  const mutate = useUsersMutation()
  const roles = MANAGEABLE_ROLES[me.role]
  const [values, setValues] = React.useState<Values>({
    name: user?.name ?? "",
    email: user?.email ?? "",
    role: user?.role ?? roles.at(-1) ?? "DEVELOPER",
  })
  const [submitted, setSubmitted] = React.useState(false)
  const [serverError, setServerError] = React.useState("")
  const [pending, setPending] = React.useState(false)
  const set = <K extends keyof Values>(key: K, value: Values[K]) => {
    setValues((v) => ({ ...v, [key]: value }))
    setServerError("")
  }

  const email = values.email.trim().toLowerCase()
  const errors = {
    name: !values.name.trim() ? "Enter their full name." : "",
    email: !EMAIL.test(email)
      ? "Enter a valid work email, like name@company.com."
      : "",
  }
  const show = (key: keyof typeof errors) => (submitted ? errors[key] : "")
  const grantingOwner = values.role === "OWNER" && user?.role !== "OWNER"
  const emailChanged = !!user && email !== user.email

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setSubmitted(true)
    if (errors.name || errors.email || pending) return
    setPending(true)
    const payload = { name: values.name.trim(), email, role: values.role }
    if (user) {
      const result = await mutate(() => updateUserAction(user.id, payload))
      setPending(false)
      if (!result.ok) return setServerError(result.error)
      toast.success(`Saved changes for ${payload.name}`)
      onDone()
    } else {
      const result = await mutate(() => inviteUserAction(payload))
      setPending(false)
      if (!result.ok) return setServerError(result.error)
      onDone()
      onInvited({
        name: payload.name,
        link: result.link,
        purpose: "invite",
        expiresInHours: result.expiresInHours,
      })
    }
  }

  return (
    <>
      <form
        id="user-form"
        noValidate
        onSubmit={submit}
        className="flex-1 overflow-y-auto px-6 py-6"
      >
        <FieldGroup className="gap-6">
          <Field data-invalid={!!show("name") || undefined}>
            <FieldLabel htmlFor="u-name">Full name</FieldLabel>
            <Input
              id="u-name"
              autoComplete="off"
              autoFocus={!user}
              maxLength={120}
              value={values.name}
              aria-invalid={!!show("name") || undefined}
              onChange={(e) => set("name", e.target.value)}
            />
            {show("name") && <FieldError>{show("name")}</FieldError>}
          </Field>

          <Field data-invalid={!!(show("email") || serverError) || undefined}>
            <FieldLabel htmlFor="u-email">Work email</FieldLabel>
            <Input
              id="u-email"
              type="email"
              autoComplete="off"
              spellCheck={false}
              maxLength={254}
              placeholder="name@company.com"
              value={values.email}
              aria-invalid={!!(show("email") || serverError) || undefined}
              onChange={(e) => set("email", e.target.value)}
            />
            {show("email") && <FieldError>{show("email")}</FieldError>}
            {emailChanged && !show("email") && (
              <p className="text-sm text-muted-foreground">
                They’ll sign in with the new address and be signed out
                everywhere now.
              </p>
            )}
          </Field>

          <FieldSet>
            <FieldLegend variant="label">Role</FieldLegend>
            <div className="grid gap-2">
              {roles.map((role) => (
                <RoleOption
                  key={role}
                  value={role}
                  checked={values.role === role}
                  onSelect={() => set("role", role)}
                />
              ))}
            </div>
            {grantingOwner && (
              <p className="flex gap-2 text-sm text-muted-foreground">
                <InfoIcon className="mt-0.5 size-4 shrink-0" />
                Owners can change anyone’s role, including other Owners, and
                remove users.
              </p>
            )}
          </FieldSet>

          {serverError && (
            <p role="alert" className="text-sm text-destructive">
              {serverError}
            </p>
          )}
        </FieldGroup>
      </form>

      <SheetFooter className="flex-row justify-end border-t px-6 py-4">
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" form="user-form" disabled={pending}>
          {pending && (
            <LoaderCircleIcon
              className="animate-spin"
              data-icon="inline-start"
            />
          )}
          {user ? "Save changes" : "Create invite link"}
        </Button>
      </SheetFooter>
    </>
  )
}

function RoleOption({
  value,
  checked,
  onSelect,
}: {
  value: Role
  checked: boolean
  onSelect: () => void
}) {
  const id = `role-${value.toLowerCase()}`
  return (
    <label
      htmlFor={id}
      className={cn(
        "flex cursor-pointer gap-3 rounded-3xl px-4 py-3 ring-1 ring-border transition-colors has-focus-visible:ring-3 has-focus-visible:ring-ring/30",
        checked ? "bg-primary/6 ring-primary/40" : "hover:bg-muted/60"
      )}
    >
      <input
        id={id}
        type="radio"
        name="role"
        value={value}
        checked={checked}
        onChange={onSelect}
        className="mt-1 size-4 shrink-0 accent-primary outline-none"
      />
      <span className="grid gap-0.5">
        <span className="text-sm font-medium">{ROLE_LABELS[value]}</span>
        <span className="text-sm text-pretty text-muted-foreground">
          {ROLE_SUMMARIES[value]}
        </span>
      </span>
    </label>
  )
}
