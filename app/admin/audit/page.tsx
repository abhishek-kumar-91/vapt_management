import Link from "next/link"

import { day } from "@/components/admin/bits"
import { EmptyRow, ListCard, ListToolbar } from "@/components/list-card"
import { PageHeader } from "@/components/page-header"
import { ToneBadge } from "@/components/status"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { listAudit } from "@/server/admin"

export const metadata = { title: "Audit log" }

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string; q?: string; before?: string }>
}) {
  const p = await searchParams
  const { rows, next } = await listAudit({
    org: p.org,
    action: p.q,
    before: p.before ? Number(p.before) : undefined,
  })
  const more = new URLSearchParams({
    ...(p.org ? { org: p.org } : {}),
    ...(p.q ? { q: p.q } : {}),
    ...(next ? { before: String(next) } : {}),
  })
  return (
    <div className="grid gap-6">
      <PageHeader
        title="Audit log"
        description={
          p.org ? (
            <>
              Entries for <span className="font-medium text-foreground">/o/{p.org}</span>.{" "}
              <Link href="/admin/audit" className="font-medium text-foreground underline underline-offset-4">
                Show all
              </Link>
            </>
          ) : (
            "Every sign-in, change and refusal on the platform, newest first. Rows can only be added."
          )
        }
      />
      <ListCard
        toolbar={<ListToolbar search={{ label: "Filter by action", placeholder: "Action starts with, e.g. org. or auth." }} />}
        more={next ? { href: `/admin/audit?${more}`, label: "Show older entries" } : null}
      >
        <Table className="min-w-[980px]">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-6">When</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Who</TableHead>
              <TableHead>Company</TableHead>
              <TableHead className="pr-6">Change</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="py-3 pl-6 tabular">{day(r.at, true)}</TableCell>
                <TableCell className="py-3">
                  <span className="flex items-center gap-2">
                    <code className="font-mono text-xs">{r.action}</code>
                    {r.outcome !== "success" && (
                      <ToneBadge tone={r.outcome === "denied" ? "warning" : "critical"}>{r.outcome}</ToneBadge>
                    )}
                  </span>
                </TableCell>
                <TableCell className="py-3">
                  <span className="grid gap-0.5">
                    <span>
                      {r.actor ?? "—"}
                      {r.actorPlatform ? " · Pentest Scout" : ""}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {r.actorRole ?? ""}
                      {r.ip ? ` · ${r.ip}` : ""}
                    </span>
                  </span>
                </TableCell>
                <TableCell className="py-3">
                  {r.orgSlug ? (
                    <Link href={`/admin/audit?org=${r.orgSlug}`} className="underline-offset-4 hover:underline">
                      {r.org}
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">Platform</span>
                  )}
                </TableCell>
                <TableCell className="max-w-80 truncate py-3 pr-6 font-mono text-xs text-muted-foreground">
                  {r.changes ? JSON.stringify(r.changes) : ""}
                </TableCell>
              </TableRow>
            ))}
            {!rows.length && <EmptyRow cols={5} title="No entries match">Try another action prefix.</EmptyRow>}
          </TableBody>
        </Table>
      </ListCard>
    </div>
  )
}
