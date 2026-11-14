"use client"

import * as React from "react"
import { BellOffIcon, CheckCheckIcon } from "lucide-react"

import { NoticeRow, useNotifications } from "@/components/notifications"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { NoticeKind } from "@/lib/notifications"

const KINDS: { value: NoticeKind; label: string }[] = [
  { value: "deadline", label: "Fix deadlines" },
  { value: "retest", label: "Retests" },
  { value: "cycle", label: "Test cycles" },
  { value: "event", label: "Escalations & events" },
]

export default function NotificationsPage() {
  const { items, unread, isRead, markRead, markAllRead } = useNotifications()
  const [view, setView] = React.useState<"all" | "unread">("all")
  const [kind, setKind] = React.useState<"all" | NoticeKind>("all")
  const visible = items.filter(
    (n) =>
      (view === "all" || !isRead(n.id)) && (kind === "all" || n.kind === kind)
  )

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Notifications"
        description="Overdue fixes, retests, due test cycles and escalations from the last two weeks."
        actions={
          <Button variant="outline" disabled={!unread} onClick={markAllRead}>
            <CheckCheckIcon data-icon="inline-start" />
            Mark all read
          </Button>
        }
      />

      <Card className="gap-4">
        <CardHeader className="flex flex-wrap items-center justify-between gap-3">
          <Tabs
            value={view}
            onValueChange={(v) => setView(v as typeof view)}
            controls="notifications-list"
          >
            <TabsList>
              <TabsTrigger value="all" className="gap-1.5">
                All
                <span className="text-xs text-muted-foreground tabular">
                  {items.length}
                </span>
              </TabsTrigger>
              <TabsTrigger value="unread" className="gap-1.5">
                Unread
                <span className="text-xs text-muted-foreground tabular">
                  {unread}
                </span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <Select value={kind} onValueChange={(v) => setKind(v as typeof kind)}>
            <SelectTrigger
              aria-label="Filter by type"
              className="w-full sm:w-52"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {KINDS.map((k) => (
                <SelectItem key={k.value} value={k.value}>
                  {k.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent id="notifications-list" className="px-3">
          {visible.length ? (
            <ul className="grid gap-0.5">
              {visible.map((n) => (
                <li key={n.id}>
                  <NoticeRow
                    notice={n}
                    unread={!isRead(n.id)}
                    onOpen={() => markRead(n.id)}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <div className="grid justify-items-center gap-2 px-6 py-14 text-center">
              <BellOffIcon className="size-5 text-muted-foreground" />
              <p className="font-medium">
                {view === "unread" ? "Nothing unread" : "You’re all caught up"}
              </p>
              <p className="text-sm text-muted-foreground">
                New deadlines, retests and escalations will show up here.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
