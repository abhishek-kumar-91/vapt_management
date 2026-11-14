import Link from "next/link"

import { day, EmptyRow } from "@/components/admin/bits"
import { PageHeader } from "@/components/page-header"
import { Card } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { listPending } from "@/server/admin"

export const metadata = { title: "Approvals" }

export default async function ApprovalsPage() {
  const rows = await listPending()
  return (
    <div className="grid gap-6">
      <PageHeader
        title="Approvals"
        description="Companies waiting for review, oldest first. Open one to approve it, reject it, or ask for changes."
      />
      <Card className="gap-0 py-0">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-6">Company</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Industry · size</TableHead>
              <TableHead className="text-right">Products</TableHead>
              <TableHead className="pr-6">Submitted</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.slug}>
                <TableCell className="pl-6">
                  <Link href={`/admin/companies/${r.slug}`} className="font-medium hover:underline">{r.name}</Link>
                </TableCell>
                <TableCell>
                  <span className="grid leading-tight">
                    <span>{r.owner ?? "—"}</span>
                    <span className="text-xs text-muted-foreground">{r.ownerEmail}</span>
                  </span>
                </TableCell>
                <TableCell className="text-muted-foreground">{[r.industry, r.size].filter(Boolean).join(" · ")}</TableCell>
                <TableCell className="text-right tabular">{r.products}</TableCell>
                <TableCell className="pr-6">{day(r.submittedAt, true)}</TableCell>
              </TableRow>
            ))}
            {!rows.length && <EmptyRow cols={5}>Nothing waiting. New companies appear here when they submit.</EmptyRow>}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}
