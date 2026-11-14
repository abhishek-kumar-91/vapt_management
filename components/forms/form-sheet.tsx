"use client"

import * as React from "react"
import { toast } from "sonner"

import {
  FormError,
  SubmitButton,
  useFormAction,
  type FormAction,
} from "@/components/forms/action-form"
import { FormFields, type FieldSpec } from "@/components/forms/form-fields"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

/** The inset right-hand sheet every form in the console uses (same frame as Invite a user). */
export const SHEET_CONTENT =
  "gap-0 outline-none data-[side=right]:w-full sm:data-[side=right]:inset-y-2 sm:data-[side=right]:right-2 sm:data-[side=right]:h-auto data-[side=right]:sm:max-w-lg sm:data-[side=right]:rounded-4xl sm:data-[side=right]:border"

/**
 * A form that adds or requests something, in a sheet opened from its own button. The sheet stays
 * open on a refusal (with the person's answers and the errors) and closes with a
 * toast on success.
 */
export function FormSheet({
  triggerLabel,
  triggerIcon,
  triggerVariant = "default",
  title,
  description,
  action,
  fields,
  submitLabel,
  pendingLabel,
  success,
  children,
}: {
  /** The button that opens the sheet. */
  triggerLabel: string
  triggerIcon?: React.ReactNode
  triggerVariant?: "default" | "outline" | "secondary"
  title: string
  description: React.ReactNode
  action: FormAction
  fields: FieldSpec[]
  submitLabel: string
  pendingLabel: string
  /** Toast shown on success; the action's own notice wins when it sends one. */
  success: string
  /** Extra content above the fields (e.g. a note about what happens next). */
  children?: React.ReactNode
}) {
  const [open, setOpen] = React.useState(false)
  return (
    <>
      <Button variant={triggerVariant} onClick={() => setOpen(true)}>
        {triggerIcon}
        {triggerLabel}
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className={SHEET_CONTENT}>
          <SheetHeader className="border-b px-6 py-5">
            <SheetTitle className="text-lg">{title}</SheetTitle>
            <SheetDescription>{description}</SheetDescription>
          </SheetHeader>
          {open && (
            <SheetForm
              action={action}
              fields={fields}
              submitLabel={submitLabel}
              pendingLabel={pendingLabel}
              onSuccess={(notice) => {
                toast.success(notice ?? success)
                setOpen(false)
              }}
              onCancel={() => setOpen(false)}
            >
              {children}
            </SheetForm>
          )}
        </SheetContent>
      </Sheet>
    </>
  )
}

function SheetForm({
  action,
  fields,
  submitLabel,
  pendingLabel,
  onSuccess,
  onCancel,
  children,
}: {
  action: FormAction
  fields: FieldSpec[]
  submitLabel: string
  pendingLabel: string
  onSuccess: (notice?: string) => void
  onCancel: () => void
  children?: React.ReactNode
}) {
  const { state, run, pending, key } = useFormAction(action)
  const id = React.useId()
  const succeeded = !!state && !state.error && !state.fieldErrors
  React.useEffect(() => {
    if (succeeded) onSuccess(state?.notice)
    // Only on a new result.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state])

  return (
    <>
      <form
        id={id}
        action={run}
        noValidate
        className="grid flex-1 content-start gap-6 overflow-y-auto px-6 py-6"
      >
        {children}
        <FormError message={state?.error} />
        <FormFields
          key={key}
          fields={fields}
          values={state?.values}
          errors={state?.fieldErrors}
          idPrefix={id}
        />
      </form>
      <SheetFooter className="flex-row justify-end border-t px-6 py-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <SubmitButton form={id} pending={pending} label={submitLabel} pendingLabel={pendingLabel} />
      </SheetFooter>
    </>
  )
}
