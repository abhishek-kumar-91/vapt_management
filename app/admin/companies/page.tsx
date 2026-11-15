import Link from "next/link"

import { day, OrgStatusBadge } from "@/components/admin/bits"
import { EmptyRow, ListCard, ListToolbar, PersonCell } from "@/components/list-card"
import { PageHeader } from "@/components/page-header"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ORG_STATUS_LABELS } from "@/lib/orgs"
import { companyCounts, listCompanies } from "@/server/admin"

export const metadata = { title: "Companies" }

export default async function CompaniesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; before?: string }>
}) {
  const params = await searchParams
  const status = params.status && params.status in ORG_STATUS_LABELS ? params.status : undefined
  const [{ rows, next }, counts] = await Promise.all([
    listCompanies({ q: params.q, status, before: params.before }),
    companyCounts(),
  ])
  const total = Object.values(counts).reduce((a, b) => a + b, 0)
  const more = new URLSearchParams({
    ...(params.q ? { q: params.q } : {}),
    ...(status ? { status } : {}),
    ...(next ? { before: next } : {}),
  })
  return (
    <div className="grid gap-6">
      <PageHeader title="Companies" description="Every company on Pentest Scout, newest first." />
      <ListCard
        toolbar={
          <ListToolbar
            tabs={{
              param: "status",
              label: "Filter by status",
              options: [
                { value: "", label: "All", count: total },
                ...(["active", "pending_review", "draft", "suspended"] as const).map((s) => ({
                  value: s,
                  label: ORG_STATUS_LABELS[s],
                  count: counts[s] ?? 0,
                })),
              ],
            }}
            search={{ label: "Search companies", placeholder: "Search name or address" }}
          />
        }
        more={next ? { href: `/admin/companies?${more}`, label: "Show older companies" } : null}
      >
        <Table className="min-w-[900px]">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-6">Company</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead className="text-right">Products</TableHead>
              <TableHead className="text-right">People</TableHead>
              <TableHead className="text-right">Open Critical · High</TableHead>
              <TableHead className="pr-6">Last activity</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="py-3 pl-6">
                  <span className="grid gap-0.5">
                    <Link href={`/admin/companies/${r.slug}`} className="font-medium underline-offset-4 hover:underline">
                      {r.name}
                    </Link>
                    <span className="text-xs text-muted-foreground">/o/{r.slug}</span>
                  </span>
                </TableCell>
                <TableCell className="py-3">
                  <OrgStatusBadge status={r.status} />
                </TableCell>
                <TableCell className="py-3">
                  {r.owner ? <PersonCell name={r.owner} detail={r.ownerEmail} /> : "—"}
                </TableCell>
                <TableCell className="py-3 text-right tabular">{r.products}</TableCell>
                <TableCell className="py-3 text-right tabular">{r.members}</TableCell>
                <TableCell className="py-3 text-right tabular">
                  <span className={r.openCritical ? "font-medium text-critical" : undefined}>{r.openCritical}</span> ·{" "}
                  {r.openHigh}
                </TableCell>
                <TableCell className="py-3 pr-6 tabular">{day(r.lastActivityAt)}</TableCell>
              </TableRow>
            ))}
            {!rows.length && (
              <EmptyRow cols={7} title="No companies match">
                Try another status or search.
              </EmptyRow>
            )}
          </TableBody>
        </Table>
      </ListCard>
    </div>
  )
}
