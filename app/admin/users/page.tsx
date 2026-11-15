import Link from "next/link"

import { adminResetLinkAction, setUserDisabledAction } from "@/app/admin/actions"
import { day } from "@/components/admin/bits"
import { EmptyRow, ListCard, ListToolbar, PersonCell } from "@/components/list-card"
import { PageHeader } from "@/components/page-header"
import { RunAction } from "@/components/run-action"
import { ToneBadge } from "@/components/status"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ROLE_LABELS } from "@/lib/auth/roles"
import { searchUsers } from "@/server/admin"

export const metadata = { title: "Users" }

const ACCOUNT_TONE = { active: "success", invited: "neutral", disabled: "critical" } as const

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams
  const people = await searchUsers(q)
  return (
    <div className="grid gap-6">
      <PageHeader title="Users" description="Every account on the platform and the companies each one belongs to." />
      <ListCard toolbar={<ListToolbar search={{ label: "Search accounts", placeholder: "Search name or email" }} />}>
        <Table className="min-w-[900px]">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-6">Person</TableHead>
              <TableHead>Companies</TableHead>
              <TableHead>Account</TableHead>
              <TableHead>Last sign-in</TableHead>
              <TableHead className="pr-6 text-right">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {people.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="py-3 pl-6">
                  <PersonCell
                    name={p.name}
                    detail={`${p.email}${p.verified ? "" : " · not confirmed"}`}
                    muted={p.status === "disabled"}
                  />
                </TableCell>
                <TableCell className="py-3 whitespace-normal">
                  {p.platformRole ? (
                    <ToneBadge tone="primary">Super Admin</ToneBadge>
                  ) : p.companies.length ? (
                    <span className="grid gap-0.5 text-sm">
                      {p.companies.map((c) => (
                        <span key={c.slug}>
                          <Link href={`/admin/companies/${c.slug}`} className="underline-offset-4 hover:underline">
                            {c.name}
                          </Link>
                          <span className="text-muted-foreground">
                            {" "}· {ROLE_LABELS[c.role]}
                            {c.status !== "active" ? ` (${c.status})` : ""}
                          </span>
                        </span>
                      ))}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">None</span>
                  )}
                </TableCell>
                <TableCell className="py-3">
                  <ToneBadge tone={ACCOUNT_TONE[p.status]} dot>
                    {p.status[0].toUpperCase() + p.status.slice(1)}
                  </ToneBadge>
                </TableCell>
                <TableCell className="py-3 tabular">{day(p.lastLoginAt)}</TableCell>
                <TableCell className="py-3 pr-6">
                  {!p.platformRole && (
                    <div className="flex justify-end gap-2">
                      {p.status === "active" && (
                        <RunAction
                          variant="ghost"
                          label="Reset link"
                          pendingLabel="Creating…"
                          success="Reset link created."
                          confirm={{
                            title: `Password reset link for ${p.name}`,
                            description: "Creates a one-time link (24 hours) and queues it in the outbox. Their current password keeps working until they use it.",
                            confirmLabel: "Create link",
                          }}
                          action={adminResetLinkAction.bind(null, p.id)}
                        />
                      )}
                      {p.status === "disabled" ? (
                        <RunAction
                          label="Enable"
                          pendingLabel="Enabling…"
                          success={`${p.name} can sign in again.`}
                          action={setUserDisabledAction.bind(null, p.id, false)}
                        />
                      ) : (
                        <RunAction
                          label="Disable"
                          pendingLabel="Disabling…"
                          success={`${p.name} is disabled and signed out everywhere.`}
                          confirm={{
                            title: `Disable ${p.name}?`,
                            description: "They’re signed out everywhere and can’t sign in to any company until enabled again.",
                            confirmLabel: "Disable account",
                            destructive: true,
                          }}
                          action={setUserDisabledAction.bind(null, p.id, true)}
                        />
                      )}
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {!people.length && <EmptyRow cols={5} title="No accounts match">Try another name or email.</EmptyRow>}
          </TableBody>
        </Table>
      </ListCard>
    </div>
  )
}
