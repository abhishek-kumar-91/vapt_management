import Link from "next/link"

import { adminResetLinkAction, setUserDisabledAction } from "@/app/admin/actions"
import { AdminAction } from "@/components/admin/admin-action"
import { day, EmptyRow, FilterBar } from "@/components/admin/bits"
import { ToneBadge } from "@/components/status"
import { PageHeader } from "@/components/page-header"
import { Card } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ROLE_LABELS } from "@/lib/auth/roles"
import { searchUsers } from "@/server/admin"

export const metadata = { title: "Users" }

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams
  const people = await searchUsers(q)
  return (
    <div className="grid gap-6">
      <PageHeader title="Users" description="Every account on the platform and the companies each one belongs to." />
      <FilterBar q={q} placeholder="Search by name or email" />
      <Card className="gap-0 py-0">
        <Table className="min-w-[900px]">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-6">Person</TableHead>
              <TableHead>Companies</TableHead>
              <TableHead>Account</TableHead>
              <TableHead>Last sign-in</TableHead>
              <TableHead className="pr-6 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {people.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="pl-6">
                  <span className="grid leading-tight">
                    <span className="font-medium">{p.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {p.email}{p.verified ? "" : " · not confirmed"}
                    </span>
                  </span>
                </TableCell>
                <TableCell className="whitespace-normal">
                  {p.platformRole ? (
                    <ToneBadge tone="primary">Super Admin</ToneBadge>
                  ) : p.companies.length ? (
                    <span className="grid gap-0.5">
                      {p.companies.map((c) => (
                        <span key={c.slug} className="text-sm">
                          <Link href={`/admin/companies/${c.slug}`} className="hover:underline">{c.name}</Link>
                          <span className="text-muted-foreground"> · {ROLE_LABELS[c.role]}{c.status !== "active" ? ` (${c.status})` : ""}</span>
                        </span>
                      ))}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">None</span>
                  )}
                </TableCell>
                <TableCell>
                  <ToneBadge tone={p.status === "active" ? "success" : p.status === "disabled" ? "critical" : "neutral"}>{p.status}</ToneBadge>
                </TableCell>
                <TableCell>{day(p.lastLoginAt)}</TableCell>
                <TableCell className="pr-6">
                  {!p.platformRole && (
                    <div className="flex flex-wrap justify-end gap-2">
                      {p.status === "active" && (
                        <AdminAction label="Reset link" pendingLabel="Creating…" success="Reset link created and queued." action={adminResetLinkAction.bind(null, p.id)} />
                      )}
                      {p.status === "disabled" ? (
                        <AdminAction label="Enable" pendingLabel="Enabling…" success={`${p.name} can sign in again.`} action={setUserDisabledAction.bind(null, p.id, false)} />
                      ) : (
                        <AdminAction variant="destructive" label="Disable" pendingLabel="Disabling…" success={`${p.name} is disabled and signed out everywhere.`} action={setUserDisabledAction.bind(null, p.id, true)} />
                      )}
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {!people.length && <EmptyRow cols={5}>No accounts match.</EmptyRow>}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}
