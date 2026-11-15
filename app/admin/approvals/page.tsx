import Link from "next/link"

import { day } from "@/components/admin/bits"
import { EmptyRow, ListCard, PersonCell } from "@/components/list-card"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { listPending } from "@/server/admin"

export const metadata = { title: "Approvals" }

export default async function ApprovalsPage() {
  const rows = await listPending()
  return (
    <div className="grid gap-6">
      <PageHeader
        title="Approvals"
        description="Companies waiting for review, oldest first. Open one to approve it, ask for changes or reject it."
      />
      <ListCard>
        <Table className="min-w-[760px]">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-6">Company</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead className="text-right">Products</TableHead>
              <TableHead>Submitted</TableHead>
              <TableHead className="pr-6 text-right">
                <span className="sr-only">Review</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.slug}>
                <TableCell className="py-3 pl-6">
                  <span className="grid gap-0.5">
                    <Link href={`/admin/companies/${r.slug}`} className="font-medium underline-offset-4 hover:underline">
                      {r.name}
                    </Link>
                    <span className="text-xs text-muted-foreground">
                      {[r.industry, r.size].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                </TableCell>
                <TableCell className="py-3">
                  {r.owner ? <PersonCell name={r.owner} detail={r.ownerEmail} /> : "—"}
                </TableCell>
                <TableCell className="py-3 text-right tabular">{r.products}</TableCell>
                <TableCell className="py-3 tabular">{day(r.submittedAt, true)}</TableCell>
                <TableCell className="py-3 pr-6 text-right">
                  <Button asChild size="sm">
                    <Link href={`/admin/companies/${r.slug}`}>Review</Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {!rows.length && (
              <EmptyRow cols={5} title="Nothing to review">
                New companies appear here as soon as they submit.
              </EmptyRow>
            )}
          </TableBody>
        </Table>
      </ListCard>
    </div>
  )
}
