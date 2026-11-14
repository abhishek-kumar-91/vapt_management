"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { LoaderCircleIcon } from "lucide-react"
import { toast } from "sonner"

import { advanceTestingAction } from "@/app/admin/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

/** Set (or move) the testing window for a request. */
export function ScheduleForm({ id, start = "", end = "" }: { id: string; start?: string; end?: string }) {
  const router = useRouter()
  const [pending, startTransition] = React.useTransition()
  const [from, setFrom] = React.useState(start)
  const [to, setTo] = React.useState(end)
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        startTransition(async () => {
          const result = await advanceTestingAction(id, "schedule", { start: from, end: to })
          if (!result.ok) return void toast.error("Not scheduled", { description: result.error })
          toast.success("Scheduled. The Owner has been emailed.")
          router.refresh()
        })
      }}
    >
      <label className="grid gap-1 text-sm">
        <span className="text-muted-foreground">Start</span>
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9" required />
      </label>
      <label className="grid gap-1 text-sm">
        <span className="text-muted-foreground">End</span>
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9" required />
      </label>
      <Button type="submit" size="sm" variant="outline" disabled={pending || !from || !to}>
        {pending && <LoaderCircleIcon className="animate-spin" />}
        {start ? "Reschedule" : "Schedule"}
      </Button>
    </form>
  )
}
