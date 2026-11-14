import Link from "next/link"

import { markOutboxSentAction } from "@/app/admin/actions"
import { AdminAction } from "@/components/admin/admin-action"
import { CopyLink } from "@/components/admin/copy-link"
import { day, EmptyRow } from "@/components/admin/bits"
import { ToneBadge } from "@/components/status"
import { PageHeader } from "@/components/page-header"
import { Card } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { emailTransport } from "@/lib/email/send"
import { listOutbox } from "@/server/admin"

export const metadata = { title: "Outbox" }

export default async function OutboxPage({ searchParams }: { searchParams: Promise<{ all?: string }> }) {
  const all = (await searchParams).all === "1"
  const rows = await listOutbox(all ? "all" : "pending")
  return (
    <div className="grid gap-6">
      <PageHeader
        title="Outbox"
        description={
          emailTransport() === "outbox"
            ? "Email isn’t connected yet, so messages wait here. Copy a link, send it to the person yourself, then mark it sent."
            : "Every email the app queued. In development they’re also printed to the server console."
        }
        actions={
          <Link href={all ? "/admin/outbox" : "/admin/outbox?all=1"} className="text-sm font-medium text-primary underline-offset-4 hover:underline">
            {all ? "Show waiting only" : "Show everything"}
          </Link>
        }
      />
      <Card className="gap-0 py-0">
        <Table className="min-w-[860px]">
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
                <TableCell className="pl-6">
                  <span className="grid leading-tight">
                    <span>{r.to}</span>
                    <span className="text-xs text-muted-foreground">{r.org ?? "Platform"}</span>
                  </span>
                </TableCell>
                <TableCell className="max-w-72 truncate">{r.subject}</TableCell>
                <TableCell>{day(r.createdAt, true)}</TableCell>
                <TableCell>
                  {r.link ? <CopyLink href={r.link} /> : <span className="text-xs text-muted-foreground">Used or expired</span>}
                </TableCell>
                <TableCell className="pr-6">
                  <div className="flex justify-end">
                    {r.status === "pending" ? (
                      <AdminAction label="Mark sent" pendingLabel="Saving…" success="Marked as sent." action={markOutboxSentAction.bind(null, r.id)} />
                    ) : (
                      <ToneBadge tone={r.status === "sent" ? "success" : "neutral"}>{r.status}</ToneBadge>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {!rows.length && <EmptyRow cols={5}>Nothing waiting to be sent.</EmptyRow>}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}
