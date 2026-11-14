import Link from "next/link"

import { resendVerificationAction } from "@/app/admin/actions"
import { AdminAction } from "@/components/admin/admin-action"
import { day, EmptyRow, OrgStatusBadge } from "@/components/admin/bits"
import { ToneBadge } from "@/components/status"
import { PageHeader, SectionHeading } from "@/components/page-header"
import { Card } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { signupFunnel } from "@/server/admin"

export const metadata = { title: "Sign-ups" }

const Stale = ({ stale }: { stale: boolean }) =>
  stale ? <ToneBadge tone="warning">Stuck 7+ days</ToneBadge> : null

export default async function SignupsPage() {
  const f = await signupFunnel()
  return (
    <div className="grid gap-8">
      <PageHeader
        title="Sign-ups"
        description="Everyone who started registering and hasn’t finished: where they stopped, and anything that failed."
      />

      <section className="grid gap-3">
        <SectionHeading title="Haven’t confirmed their email" description={`${f.unverified.length} people. Send a new link if theirs expired.`} />
        <Card className="gap-0 py-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-6">Person</TableHead>
                <TableHead>Signed up</TableHead>
                <TableHead className="pr-6 text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {f.unverified.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="pl-6">
                    <span className="grid leading-tight">
                      <span className="font-medium">{u.name}</span>
                      <span className="text-xs text-muted-foreground">{u.email}</span>
                    </span>
                  </TableCell>
                  <TableCell><span className="flex items-center gap-2">{day(u.createdAt)} <Stale stale={u.stale} /></span></TableCell>
                  <TableCell className="pr-6">
                    <div className="flex justify-end">
                      <AdminAction label="Send new link" pendingLabel="Sending…" success="New verification link queued." action={resendVerificationAction.bind(null, u.id)} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {!f.unverified.length && <EmptyRow cols={3}>Nobody is waiting to confirm.</EmptyRow>}
            </TableBody>
          </Table>
        </Card>
      </section>

      <section className="grid gap-3">
        <SectionHeading title="Confirmed, but no company yet" description={`${f.noCompany.length} people stopped before creating their company.`} />
        <Card className="gap-0 py-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-6">Person</TableHead>
                <TableHead className="pr-6">Signed up</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {f.noCompany.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="pl-6">
                    <span className="grid leading-tight">
                      <span className="font-medium">{u.name}</span>
                      <span className="text-xs text-muted-foreground">{u.email}</span>
                    </span>
                  </TableCell>
                  <TableCell className="pr-6"><span className="flex items-center gap-2">{day(u.createdAt)} <Stale stale={u.stale} /></span></TableCell>
                </TableRow>
              ))}
              {!f.noCompany.length && <EmptyRow cols={2}>Nobody is stuck here.</EmptyRow>}
            </TableBody>
          </Table>
        </Card>
      </section>

      <section className="grid gap-3">
        <SectionHeading title="Companies still being set up" description="Created but not submitted, or sent back and not resubmitted." />
        <Card className="gap-0 py-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-6">Company</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead className="pr-6">Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {f.drafts.map((d) => (
                <TableRow key={d.slug}>
                  <TableCell className="pl-6">
                    <Link href={`/admin/companies/${d.slug}`} className="font-medium hover:underline">{d.name}</Link>
                    {d.reviewNote && <span className="block text-xs text-muted-foreground">Note: {d.reviewNote}</span>}
                  </TableCell>
                  <TableCell><OrgStatusBadge status={d.status} /></TableCell>
                  <TableCell>
                    <span className="grid leading-tight">
                      <span>{d.owner ?? "—"}</span>
                      <span className="text-xs text-muted-foreground">{d.ownerEmail}</span>
                    </span>
                  </TableCell>
                  <TableCell className="pr-6"><span className="flex items-center gap-2">{day(d.createdAt)} <Stale stale={d.stale} /></span></TableCell>
                </TableRow>
              ))}
              {!f.drafts.length && <EmptyRow cols={4}>No companies in setup.</EmptyRow>}
            </TableBody>
          </Table>
        </Card>
      </section>

      <section className="grid gap-3">
        <SectionHeading title="Failures" description="Refused or failed sign-up and verification attempts (duplicates, throttling)." />
        <Card className="gap-0 py-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-6">What</TableHead>
                <TableHead>Account</TableHead>
                <TableHead className="pr-6">When</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {f.failures.map((x, i) => (
                <TableRow key={i}>
                  <TableCell className="pl-6">
                    {x.action} <span className="text-muted-foreground">· {x.outcome}{x.meta && "reason" in x.meta ? ` · ${String(x.meta.reason).replace(/_/g, " ")}` : ""}</span>
                  </TableCell>
                  <TableCell>{x.email ?? "Unknown email"}</TableCell>
                  <TableCell className="pr-6">{day(x.at, true)}</TableCell>
                </TableRow>
              ))}
              {!f.failures.length && <EmptyRow cols={3}>No failures recorded.</EmptyRow>}
            </TableBody>
          </Table>
        </Card>
      </section>
    </div>
  )
}
