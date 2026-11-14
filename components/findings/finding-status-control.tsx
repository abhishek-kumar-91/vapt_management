"use client"

import * as React from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  ACTIVE_FINDING_STATUSES,
  CLOSED_STATUSES,
  EXIT_STATUSES,
} from "@/lib/sop"
import type { Finding, FindingStatus } from "@/lib/types"

export function FindingStatusControl({
  finding,
  onChange,
}: {
  finding: Finding
  onChange: (id: string, status: FindingStatus, reason?: string) => void
}) {
  const [pending, setPending] = React.useState<FindingStatus | "">("")
  const [reason, setReason] = React.useState("")

  const change = (status: string) => {
    const next = status as FindingStatus
    if (EXIT_STATUSES.includes(next)) {
      setPending(next)
      setReason(finding.statusReason || "")
      return
    }
    setPending("")
    onChange(finding.id, next)
  }

  return (
    <div className="grid min-w-40 gap-2">
      <Select value={pending || finding.status} onValueChange={change}>
        <SelectTrigger
          size="sm"
          aria-label={`Status for ${finding.id}`}
          className="w-full"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent position="popper">
          <SelectGroup>
            <SelectLabel>Active</SelectLabel>
            {ACTIVE_FINDING_STATUSES.map((status) => (
              <SelectItem key={status} value={status}>
                {status}
              </SelectItem>
            ))}
          </SelectGroup>
          <SelectSeparator />
          <SelectGroup>
            <SelectLabel>Closed</SelectLabel>
            {CLOSED_STATUSES.map((status) => (
              <SelectItem key={status} value={status}>
                {status}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
      {pending ? (
        <form
          className="grid gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            onChange(finding.id, pending, reason.trim())
            setPending("")
          }}
        >
          <Input
            autoFocus
            className="h-8"
            aria-label={`Reason for ${pending} ${finding.id}`}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Reason / Manager approval (required)"
          />
          <div className="flex gap-1.5">
            <Button type="submit" size="xs" disabled={!reason.trim()}>
              Save
            </Button>
            <Button
              type="button"
              size="xs"
              variant="ghost"
              onClick={() => setPending("")}
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        finding.statusReason && (
          <span
            className="truncate text-xs text-muted-foreground"
            title={finding.statusReason}
          >
            Reason: {finding.statusReason}
          </span>
        )
      )}
    </div>
  )
}
