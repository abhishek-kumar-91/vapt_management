"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { CheckIcon, CopyIcon, LoaderCircleIcon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

type Result = { ok: true; link?: string } | { ok: false; error: string }

/**
 * An admin action button. With `note`, it first opens a short text box (a reason or request),
 * required before confirming. Shows a copyable link when the action returns one.
 */
export function AdminAction({
  action,
  label,
  pendingLabel,
  success,
  variant = "outline",
  note,
}: {
  action: (note: string) => Promise<Result>
  label: string
  pendingLabel: string
  success: string
  variant?: "default" | "outline" | "destructive" | "ghost"
  note?: { label: string; placeholder: string; confirm: string }
}) {
  const router = useRouter()
  const [pending, startTransition] = React.useTransition()
  const [open, setOpen] = React.useState(false)
  const [text, setText] = React.useState("")
  const [link, setLink] = React.useState<string | null>(null)
  const [copied, setCopied] = React.useState(false)
  const id = React.useId()

  const run = () =>
    startTransition(async () => {
      const result = await action(text).catch(() => ({
        ok: false as const,
        error: "That didn’t go through. Check your connection and try again.",
      }))
      if (!result.ok) return void toast.error("Not done", { description: result.error })
      toast.success(success)
      setOpen(false)
      setText("")
      if (result.link) setLink(result.link)
      router.refresh()
    })

  if (link)
    return (
      <div className="flex min-w-0 items-center gap-2">
        <code className="min-w-0 truncate rounded-xl bg-muted px-2.5 py-1.5 text-xs">{link}</code>
        <Button
          size="sm"
          variant="outline"
          onClick={async () => {
            await navigator.clipboard.writeText(link)
            setCopied(true)
          }}
        >
          {copied ? <CheckIcon /> : <CopyIcon />}
          {copied ? "Copied" : "Copy link"}
        </Button>
      </div>
    )

  if (note && open)
    return (
      <div className="grid w-full gap-2 sm:min-w-80">
        <label htmlFor={id} className="text-sm font-medium">
          {note.label}
        </label>
        <Textarea
          id={id}
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={note.placeholder}
          maxLength={2000}
          className="min-h-20"
        />
        <div className="flex gap-2">
          <Button size="sm" variant={variant} disabled={pending || !text.trim()} onClick={run}>
            {pending && <LoaderCircleIcon className="animate-spin" />}
            {pending ? pendingLabel : note.confirm}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        </div>
      </div>
    )

  return (
    <Button
      size="sm"
      variant={variant}
      disabled={pending}
      onClick={() => (note ? setOpen(true) : run())}
    >
      {pending && <LoaderCircleIcon className="animate-spin" />}
      {pending ? pendingLabel : label}
    </Button>
  )
}
