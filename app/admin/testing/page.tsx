import Link from "next/link"

import { day } from "@/components/admin/bits"
import { EmptyRow, ListCard, ListToolbar } from "@/components/list-card"
import { PageHeader } from "@/components/page-header"
import { ProductAvatar } from "@/components/product-avatar"
import { ToneBadge } from "@/components/status"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { TESTING_LABELS, TESTING_TONE, type TestingStatus } from "@/lib/testing"
import { testingCounts } from "@/server/admin"
import { listAllRequests } from "@/server/testing"

export const metadata = { title: "Testing requests" }

const TABS: TestingStatus[] = ["submitted", "accepted", "scheduled", "in_progress", "completed"]

export default async function AdminTestingPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const requested = (await searchParams).status
  const status = requested && requested in TESTING_LABELS ? (requested as TestingStatus) : undefined
  const [rows, counts] = await Promise.all([listAllRequests(status), testingCounts()])
  const total = Object.values(counts).reduce((a, b) => a + b, 0)
  return (
    <div className="grid gap-6">
      <PageHeader
        title="Testing requests"
        description="Companies asking Pentest Scout to test a product. New requests first, then work in progress."
      />
      <ListCard
        toolbar={
          <ListToolbar
            tabs={{
              param: "status",
              label: "Filter by status",
              options: [
                { value: "", label: "All", count: total },
                ...TABS.map((s) => ({ value: s, label: s === "submitted" ? "New" : TESTING_LABELS[s], count: counts[s] ?? 0 })),
              ],
            }}
          />
        }
      >
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
                <TableCell className="py-3 pl-6">
                  <Link href={`/admin/testing/${r.id}`} className="flex items-center gap-3 underline-offset-4 hover:underline">
                    <ProductAvatar id={r.productSlug} name={r.productName} />
                    <span className="grid min-w-0 gap-0.5">
                      <span className="truncate font-medium">{r.productName}</span>
                      <span className="max-w-72 truncate text-xs text-muted-foreground">{r.scope}</span>
                    </span>
                  </Link>
                </TableCell>
                <TableCell className="py-3">
                  <Link href={`/admin/companies/${r.orgSlug}`} className="underline-offset-4 hover:underline">
                    {r.orgName}
                  </Link>
                </TableCell>
                <TableCell className="py-3">
                  <ToneBadge tone={TESTING_TONE[r.status as TestingStatus]} dot>
                    {TESTING_LABELS[r.status as TestingStatus]}
                  </ToneBadge>
                </TableCell>
                <TableCell className="py-3">{r.assignee ?? <span className="text-muted-foreground">Unassigned</span>}</TableCell>
                <TableCell className="py-3 pr-6 tabular">{day(r.createdAt)}</TableCell>
              </TableRow>
            ))}
            {!rows.length && <EmptyRow cols={5} title="No testing requests here">Requests appear when a company asks Pentest Scout to test a product.</EmptyRow>}
          </TableBody>
        </Table>
      </ListCard>
    </div>
  )
}
