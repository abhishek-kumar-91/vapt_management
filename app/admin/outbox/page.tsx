import { MailIcon } from "lucide-react"

import { markOutboxSentAction } from "@/app/admin/actions"
import { day } from "@/components/admin/bits"
import { CopyLink } from "@/components/admin/copy-link"
import { EmptyRow, ListCard, ListToolbar } from "@/components/list-card"
import { PageHeader } from "@/components/page-header"
import { RunAction } from "@/components/run-action"
import { ToneBadge } from "@/components/status"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { emailTransport } from "@/lib/email/send"
import { listOutbox } from "@/server/admin"

export const metadata = { title: "Outbox" }

const STATUS_TONE = { pending: "warning", sent: "success", failed: "critical", cancelled: "neutral" } as const

export default async function OutboxPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const all = (await searchParams).show === "all"
  const rows = await listOutbox(all ? "all" : "pending")
  return (
    <div className="grid gap-6">
      <PageHeader title="Outbox" description="Every email the platform has queued, newest first." />
      {emailTransport() === "outbox" && (
        <Alert>
          <MailIcon />
          <AlertTitle>Email isn’t connected yet</AlertTitle>
          <AlertDescription>
            Messages wait here. Copy a link, send it to the person yourself, then mark it sent.
          </AlertDescription>
        </Alert>
      )}
      <ListCard
        toolbar={
          <ListToolbar
            tabs={{
              param: "show",
              label: "Which emails",
              options: [
                { value: "", label: "Waiting" },
                { value: "all", label: "Everything" },
              ],
            }}
          />
        }
      >
        <Table className="min-w-[880px]">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-6">To</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead>Queued</TableHead>
              <TableHead>Link</TableHead>
              <TableHead className="pr-6 text-right">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="py-3 pl-6">
                  <span className="grid gap-0.5">
                    <span className="font-medium">{r.to}</span>
                    <span className="text-xs text-muted-foreground">{r.org ?? "Platform"}</span>
                  </span>
                </TableCell>
                <TableCell className="max-w-72 truncate py-3">{r.subject}</TableCell>
                <TableCell className="py-3 tabular">{day(r.createdAt, true)}</TableCell>
                <TableCell className="py-3">
                  {r.link ? <CopyLink href={r.link} /> : <span className="text-sm text-muted-foreground">Used or expired</span>}
                </TableCell>
                <TableCell className="py-3 pr-6 text-right">
                  {r.status === "pending" ? (
                    <RunAction
                      label="Mark sent"
                      pendingLabel="Saving…"
                      success="Marked as sent."
                      action={markOutboxSentAction.bind(null, r.id)}
                    />
                  ) : (
                    <ToneBadge tone={STATUS_TONE[r.status]} dot>
                      {r.status[0].toUpperCase() + r.status.slice(1)}
                    </ToneBadge>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {!rows.length && (
              <EmptyRow cols={5} title={all ? "No emails yet" : "Nothing waiting to be sent"} />
            )}
          </TableBody>
        </Table>
      </ListCard>
    </div>
  )
}
