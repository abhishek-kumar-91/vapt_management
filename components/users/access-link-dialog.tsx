"use client"

import * as React from "react"
import { CheckIcon, CopyIcon } from "lucide-react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export interface AccessLink {
  name: string
  link: string
  purpose: "invite" | "password_reset"
  expiresInHours: number
}

/** Shows a one-time invite or reset link to hand over. Nothing is emailed yet. */
export function AccessLinkDialog({
  value,
  onClose,
}: {
  value: AccessLink | null
  onClose: () => void
}) {
  const [shown, setShown] = React.useState(value)
  if (value && value !== shown) setShown(value)
  const [copied, setCopied] = React.useState(false)
  const v = value ?? shown
  if (!v) return null

  const copy = async () => {
    await navigator.clipboard.writeText(v.link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <AlertDialog open={!!value} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {v.purpose === "invite"
              ? `Send ${v.name} their invite link`
              : `Send ${v.name} their reset link`}
          </AlertDialogTitle>
          <AlertDialogDescription>
            Emails aren’t sent automatically yet, so share this link with them
            directly. It works once and expires in {v.expiresInHours} hours.
            Anyone with the link can set this account’s password.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex gap-2">
          <Input
            readOnly
            value={v.link}
            aria-label="One-time link"
            className="font-mono text-xs"
            onFocus={(e) => e.currentTarget.select()}
          />
          <Button variant="outline" onClick={copy} className="shrink-0">
            {copied ? (
              <CheckIcon data-icon="inline-start" />
            ) : (
              <CopyIcon data-icon="inline-start" />
            )}
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
        <AlertDialogFooter>
          <AlertDialogAction onClick={onClose}>Done</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
