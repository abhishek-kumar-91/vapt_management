import Link from "next/link"

import { resendVerificationAction } from "@/app/admin/actions"
import { day, OrgStatusBadge } from "@/components/admin/bits"
import { EmptyRow, ListCard, ListToolbar, PersonCell } from "@/components/list-card"
import { PageHeader } from "@/components/page-header"
import { RunAction } from "@/components/run-action"
import { ToneBadge } from "@/components/status"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { signupFunnel } from "@/server/admin"

export const metadata = { title: "Sign-ups" }

const STAGES = {
  unverified: { label: "Not confirmed", empty: "Everyone who signed up has confirmed their email." },
  "no-company": { label: "No company yet", empty: "Nobody stopped before creating their company." },
  setup: { label: "Setting up", empty: "No companies are part-way through setup." },
  failures: { label: "Failures", empty: "No refused or failed attempts." },
} as const
type Stage = keyof typeof STAGES

const Stuck = ({ stale }: { stale: boolean }) =>
  stale ? <ToneBadge tone="warning">Stuck 7+ days</ToneBadge> : null

export default async function SignupsPage({ searchParams }: { searchParams: Promise<{ stage?: string }> }) {
  const requested = (await searchParams).stage
  const stage: Stage = requested && requested in STAGES ? (requested as Stage) : "unverified"
  const f = await signupFunnel()
  const counts: Record<Stage, number> = {
    unverified: f.unverified.length,
    "no-company": f.noCompany.length,
    setup: f.drafts.length,
    failures: f.failures.length,
  }
  const people = stage === "unverified" ? f.unverified : f.noCompany

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Sign-ups"
        description="People who started registering and haven’t finished: where each one stopped, and what failed."
      />
      <ListCard
        toolbar={
          <ListToolbar
            tabs={{
              param: "stage",
              label: "Sign-up stage",
              options: (Object.keys(STAGES) as Stage[]).map((s) => ({
                value: s === "unverified" ? "" : s,
                label: STAGES[s].label,
                count: counts[s],
              })),
            }}
          />
        }
      >
        {(stage === "unverified" || stage === "no-company") && (
          <Table className="min-w-[640px]">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-6">Person</TableHead>
                <TableHead>Signed up</TableHead>
                <TableHead className="pr-6 text-right">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {people.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="py-3 pl-6">
                    <PersonCell name={u.name} detail={u.email} />
                  </TableCell>
                  <TableCell className="py-3">
                    <span className="flex items-center gap-2 tabular">
                      {day(u.createdAt)} <Stuck stale={u.stale} />
                    </span>
                  </TableCell>
                  <TableCell className="py-3 pr-6 text-right">
                    {stage === "unverified" && (
                      <RunAction
                        label="Send new link"
                        pendingLabel="Sending…"
                        success="New confirmation link queued in the outbox."
                        action={resendVerificationAction.bind(null, u.id)}
                      />
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {!people.length && <EmptyRow cols={3} title={STAGES[stage].empty} />}
            </TableBody>
          </Table>
        )}

        {stage === "setup" && (
          <Table className="min-w-[720px]">
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
                  <TableCell className="py-3 pl-6">
                    <span className="grid gap-0.5">
                      <Link href={`/admin/companies/${d.slug}`} className="font-medium underline-offset-4 hover:underline">
                        {d.name}
                      </Link>
                      {d.reviewNote && (
                        <span className="max-w-72 truncate text-xs text-muted-foreground">Note: {d.reviewNote}</span>
                      )}
                    </span>
                  </TableCell>
                  <TableCell className="py-3">
                    <OrgStatusBadge status={d.status} />
                  </TableCell>
                  <TableCell className="py-3">{d.owner ? <PersonCell name={d.owner} detail={d.ownerEmail} /> : "—"}</TableCell>
                  <TableCell className="py-3 pr-6">
                    <span className="flex items-center gap-2 tabular">
                      {day(d.createdAt)} <Stuck stale={d.stale} />
                    </span>
                  </TableCell>
                </TableRow>
              ))}
              {!f.drafts.length && <EmptyRow cols={4} title={STAGES.setup.empty} />}
            </TableBody>
          </Table>
        )}

        {stage === "failures" && (
          <Table className="min-w-[640px]">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-6">What happened</TableHead>
                <TableHead>Account</TableHead>
                <TableHead className="pr-6">When</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {f.failures.map((x, i) => (
                <TableRow key={i}>
                  <TableCell className="py-3 pl-6">
                    <span className="flex items-center gap-2">
                      <code className="font-mono text-xs">{x.action}</code>
                      <ToneBadge tone={x.outcome === "denied" ? "warning" : "critical"}>{x.outcome}</ToneBadge>
                      {x.meta && "reason" in x.meta && (
                        <span className="text-sm text-muted-foreground">{String(x.meta.reason).replace(/_/g, " ")}</span>
                      )}
                    </span>
                  </TableCell>
                  <TableCell className="py-3">{x.email ?? "Unknown email"}</TableCell>
                  <TableCell className="py-3 pr-6 tabular">{day(x.at, true)}</TableCell>
                </TableRow>
              ))}
              {!f.failures.length && <EmptyRow cols={3} title={STAGES.failures.empty} />}
            </TableBody>
          </Table>
        )}
      </ListCard>
    </div>
  )
}
