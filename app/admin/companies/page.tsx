import Link from "next/link"

import { day, EmptyRow, FilterBar, OrgStatusBadge } from "@/components/admin/bits"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ORG_STATUS_LABELS } from "@/lib/orgs"
import { listCompanies } from "@/server/admin"

export const metadata = { title: "Companies" }

export default async function CompaniesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; before?: string }>
}) {
  const params = await searchParams
  const status = params.status && params.status in ORG_STATUS_LABELS ? params.status : undefined
  const { rows, next } = await listCompanies({ q: params.q, status, before: params.before })
  const more = new URLSearchParams({ ...(params.q ? { q: params.q } : {}), ...(status ? { status } : {}), ...(next ? { before: next } : {}) })
  return (
    <div className="grid gap-6">
      <PageHeader title="Companies" description="Every company on Pentest Scout, newest first." />
      <FilterBar
        q={params.q}
        placeholder="Search by name or address"
        select={{
          name: "status",
          value: status,
          options: [{ value: "", label: "Any status" }, ...Object.entries(ORG_STATUS_LABELS).map(([value, label]) => ({ value, label }))],
        }}
      />
      <Card className="gap-0 py-0">
        <Table className="min-w-[860px]">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-6">Company</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead className="text-right">Products</TableHead>
              <TableHead className="text-right">People</TableHead>
              <TableHead className="text-right">Open crit · high</TableHead>
              <TableHead className="pr-6">Last activity</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="pl-6">
                  <Link href={`/admin/companies/${r.slug}`} className="grid leading-tight hover:underline">
                    <span className="font-medium">{r.name}</span>
                    <span className="text-xs text-muted-foreground">/o/{r.slug}</span>
                  </Link>
                </TableCell>
                <TableCell><OrgStatusBadge status={r.status} /></TableCell>
                <TableCell>
                  <span className="grid leading-tight">
                    <span>{r.owner ?? "—"}</span>
                    <span className="text-xs text-muted-foreground">{r.ownerEmail}</span>
                  </span>
                </TableCell>
                <TableCell className="text-right tabular">{r.products}</TableCell>
                <TableCell className="text-right tabular">{r.members}</TableCell>
                <TableCell className="text-right tabular">{r.openCritical} · {r.openHigh}</TableCell>
                <TableCell className="pr-6">{day(r.lastActivityAt)}</TableCell>
              </TableRow>
            ))}
            {!rows.length && <EmptyRow cols={7}>No companies match.</EmptyRow>}
          </TableBody>
        </Table>
      </Card>
      {next && (
        <Button asChild variant="outline" className="w-fit">
          <Link href={`/admin/companies?${more}`}>Older companies</Link>
        </Button>
      )}
    </div>
  )
}
