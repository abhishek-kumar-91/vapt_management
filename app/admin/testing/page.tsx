import Link from "next/link"

import { day, EmptyRow } from "@/components/admin/bits"
import { PageHeader } from "@/components/page-header"
import { ToneBadge } from "@/components/status"
import { Card } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { TESTING_LABELS, TESTING_TONE, type TestingStatus } from "@/lib/testing"
import { listAllRequests } from "@/server/testing"

export const metadata = { title: "Testing requests" }

export default async function AdminTestingPage() {
  const rows = await listAllRequests()
  return (
    <div className="grid gap-6">
      <PageHeader
        title="Testing requests"
        description="Companies asking Pentest Scout to test a product. New requests first, then work in progress."
      />
      <Card className="gap-0 py-0">
        <Table className="min-w-[820px]">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-6">Product</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Assigned</TableHead>
              <TableHead className="pr-6">Requested</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="pl-6">
                  <Link href={`/admin/testing/${r.id}`} className="font-medium hover:underline">{r.productName}</Link>
                </TableCell>
                <TableCell>
                  <Link href={`/admin/companies/${r.orgSlug}`} className="hover:underline">{r.orgName}</Link>
                </TableCell>
                <TableCell>
                  <ToneBadge tone={TESTING_TONE[r.status as TestingStatus]} dot>{TESTING_LABELS[r.status as TestingStatus]}</ToneBadge>
                </TableCell>
                <TableCell>{r.assignee ?? "—"}</TableCell>
                <TableCell className="pr-6">{day(r.createdAt)}</TableCell>
              </TableRow>
            ))}
            {!rows.length && <EmptyRow cols={5}>No testing requests yet.</EmptyRow>}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}
