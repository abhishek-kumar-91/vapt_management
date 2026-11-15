"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { CheckIcon, CopyIcon, LoaderCircleIcon } from "lucide-react"
import { toast } from "sonner"

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { DatePicker } from "@/components/ui/date-picker"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

/** Results from either kind of server action used across the app. */
type Result =
  | { ok: true; link?: string }
  | { ok: false; error?: string }
  | { error?: string; done?: boolean; notice?: string }
  | null
  | undefined

const failed = (r: Result): string | null =>
  r && ("ok" in r ? r.ok === false : !!r.error)
    ? ((r as { error?: string }).error ?? "That didn’t go through.")
    : null

export interface Confirm {
  title: string
  description: React.ReactNode
  confirmLabel: string
  destructive?: boolean
  /** Ask for a short text before confirming (a reason, a note for the company). */
  note?: { label: string; placeholder?: string; required?: boolean }
  /** Ask for a start and end date (e.g. a testing window). */
  dates?: { start?: string; end?: string }
}

/**
 * A button that runs a server action, the same way everywhere: optional confirmation dialog
 * (with a reason or a date range), pending state, a toast for the outcome, then a refresh.
 * When the action returns a one-time link, it opens in a dialog to copy.
 */
export function RunAction({
  action,
  label,
  pendingLabel,
  success,
  variant = "outline",
  size = "sm",
  icon,
  confirm,
  className,
}: {
  /**
   * A bound server action. It receives the note (string) or the date range ({ start, end }) when
   * the confirmation asks for one, and nothing otherwise.
   */
  action: (input: never) => Promise<Result>
  label: string
  pendingLabel: string
  success: string
  variant?: "default" | "outline" | "destructive" | "ghost" | "secondary"
  size?: "sm" | "default"
  icon?: React.ReactNode
  confirm?: Confirm
  className?: string
}) {
  const router = useRouter()
  const [pending, start] = React.useTransition()
  const [open, setOpen] = React.useState(false)
  const [note, setNote] = React.useState("")
  const [range, setRange] = React.useState({
    start: confirm?.dates?.start ?? "",
    end: confirm?.dates?.end ?? "",
  })
  const [error, setError] = React.useState("")
  const [link, setLink] = React.useState<string | null>(null)
  const id = React.useId()

  const run = () =>
    start(async () => {
      const input = confirm?.dates ? range : confirm?.note ? note.trim() : undefined
      const result = await (action as (i: unknown) => Promise<Result>)(input).catch(
        () => ({ ok: false, error: "Check your connection and try again." }) as const
      )
      const problem = failed(result)
      if (problem) {
        if (open) setError(problem)
        else toast.error("Not done", { description: problem })
        return
      }
      setOpen(false)
      setNote("")
      setError("")
      const notice = result && "notice" in result ? result.notice : undefined
      toast.success(notice ?? success)
      if (result && "link" in result && result.link) setLink(result.link)
      router.refresh()
    })

  const needsNote = !!confirm?.note?.required && !note.trim()
  const needsDates =
    !!confirm?.dates && (!range.start || !range.end || range.end < range.start)

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        disabled={pending}
        className={className}
        onClick={() => (confirm ? setOpen(true) : run())}
      >
        {pending && !open ? (
          <LoaderCircleIcon className="animate-spin" data-icon="inline-start" />
        ) : (
          icon
        )}
        {pending && !open ? pendingLabel : label}
      </Button>

      {confirm && (
        <AlertDialog
          open={open}
          onOpenChange={(next) => {
            if (!pending) setOpen(next)
            if (!next) setError("")
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{confirm.title}</AlertDialogTitle>
              <AlertDialogDescription>{confirm.description}</AlertDialogDescription>
            </AlertDialogHeader>
            {(confirm.note || confirm.dates) && (
              <FieldGroup className="gap-4">
                {confirm.note && (
                  <Field data-invalid={!!error || undefined}>
                    <FieldLabel htmlFor={`${id}-note`}>{confirm.note.label}</FieldLabel>
                    <Textarea
                      id={`${id}-note`}
                      autoFocus
                      value={note}
                      maxLength={2000}
                      placeholder={confirm.note.placeholder}
                      onChange={(e) => setNote(e.target.value)}
                      className="min-h-24"
                    />
                  </Field>
                )}
                {confirm.dates && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field>
                      <FieldLabel htmlFor={`${id}-start`}>Start</FieldLabel>
                      <DatePicker
                        id={`${id}-start`}
                        value={range.start}
                        onChange={(v) => setRange((r) => ({ ...r, start: v }))}
                      />
                    </Field>
                    <Field>
                      <FieldLabel htmlFor={`${id}-end`}>End</FieldLabel>
                      <DatePicker
                        id={`${id}-end`}
                        value={range.end}
                        onChange={(v) => setRange((r) => ({ ...r, end: v }))}
                      />
                    </Field>
                  </div>
                )}
                {error && <FieldError>{error}</FieldError>}
              </FieldGroup>
            )}
            {!confirm.note && !confirm.dates && error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <AlertDialogFooter>
              <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
              <Button
                variant={confirm.destructive ? "destructive" : "default"}
                disabled={pending || needsNote || needsDates}
                onClick={run}
              >
                {pending && (
                  <LoaderCircleIcon className="animate-spin" data-icon="inline-start" />
                )}
                {pending ? pendingLabel : confirm.confirmLabel}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      <LinkDialog link={link} onClose={() => setLink(null)} />
    </>
  )
}

/** A one-time link to hand over by hand while email isn't connected. */
export function LinkDialog({
  link,
  onClose,
  title = "Copy the link",
  description = "Emails aren’t sent automatically yet, so share this link with them directly. It works once.",
}: {
  link: string | null
  onClose: () => void
  title?: string
  description?: string
}) {
  const [copied, setCopied] = React.useState(false)
  const id = React.useId()
  return (
    <Dialog
      open={!!link}
      onOpenChange={(open) => {
        if (!open) {
          onClose()
          setCopied(false)
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <Field>
          <FieldLabel htmlFor={id} className="sr-only">
            Link
          </FieldLabel>
          <Input id={id} readOnly value={link ?? ""} onFocus={(e) => e.target.select()} className="font-mono text-xs" />
        </Field>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Done
          </Button>
          <Button
            onClick={async () => {
              await navigator.clipboard.writeText(link ?? "")
              setCopied(true)
            }}
          >
            {copied ? <CheckIcon data-icon="inline-start" /> : <CopyIcon data-icon="inline-start" />}
            {copied ? "Copied" : "Copy link"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
