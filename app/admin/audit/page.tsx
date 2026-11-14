import Link from "next/link"

import { day, EmptyRow } from "@/components/admin/bits"
import { ToneBadge } from "@/components/status"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { listAudit } from "@/server/admin"

export const metadata = { title: "Audit log" }

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string; action?: string; before?: string }>
}) {
  const p = await searchParams
  const { rows, next } = await listAudit({ org: p.org, action: p.action, before: p.before ? Number(p.before) : undefined })
  const more = new URLSearchParams({ ...(p.org ? { org: p.org } : {}), ...(p.action ? { action: p.action } : {}), ...(next ? { before: String(next) } : {}) })
  return (
    <div className="grid gap-6">
      <PageHeader title="Audit log" description="Every sign-in, change and refusal on the platform, newest first. Rows can only be added." />
      <form method="get" className="flex flex-wrap items-center gap-2" role="search">
        <Input name="org" defaultValue={p.org} placeholder="Company address, e.g. acme" aria-label="Company address" className="h-10 w-full sm:w-60" />
        <Input name="action" defaultValue={p.action} placeholder="Action starts with, e.g. auth." aria-label="Action" className="h-10 w-full sm:w-60" />
        <Button type="submit" variant="outline" className="h-10">Filter</Button>
      </form>
      <Card className="gap-0 py-0">
        <Table className="min-w-[960px]">
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
                <TableCell className="pl-6 tabular">{day(r.at, true)}</TableCell>
                <TableCell>
                  <span className="flex items-center gap-2">
                    <code className="text-xs">{r.action}</code>
                    {r.outcome !== "success" && <ToneBadge tone={r.outcome === "denied" ? "warning" : "critical"}>{r.outcome}</ToneBadge>}
                  </span>
                </TableCell>
                <TableCell>
                  <span className="grid leading-tight">
                    <span>{r.actor ?? "—"}{r.actorPlatform ? " · Pentest Scout" : ""}</span>
                    <span className="text-xs text-muted-foreground">{r.actorRole ?? ""}{r.ip ? ` · ${r.ip}` : ""}</span>
                  </span>
                </TableCell>
                <TableCell>
                  {r.orgSlug ? <Link href={`/admin/companies/${r.orgSlug}`} className="hover:underline">{r.org}</Link> : <span className="text-muted-foreground">Platform</span>}
                </TableCell>
                <TableCell className="max-w-80 truncate pr-6 font-mono text-xs text-muted-foreground">
                  {r.changes ? JSON.stringify(r.changes) : ""}
                </TableCell>
              </TableRow>
            ))}
            {!rows.length && <EmptyRow cols={5}>No entries match.</EmptyRow>}
          </TableBody>
        </Table>
      </Card>
      {next && (
        <Button asChild variant="outline" className="w-fit">
          <Link href={`/admin/audit?${more}`}>Older entries</Link>
        </Button>
      )}
    </div>
  )
}
