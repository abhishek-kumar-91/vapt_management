import Link from "next/link"
import { notFound } from "next/navigation"
import { ExternalLinkIcon } from "lucide-react"

import { advanceTestingAction } from "@/app/admin/actions"
import { AdminAction } from "@/components/admin/admin-action"
import { day } from "@/components/admin/bits"
import { ScheduleForm } from "@/components/admin/schedule-form"
import { PageHeader } from "@/components/page-header"
import { ToneBadge } from "@/components/status"
import { Button } from "@/components/ui/button"
import { TESTING_LABELS, TESTING_TONE, type TestingStatus } from "@/lib/testing"
import { getRequest } from "@/server/testing"

export const metadata = { title: "Testing request" }

export default async function AdminTestingRequestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const r = await getRequest(id)
  if (!r) notFound()
  const status = r.status as TestingStatus
  const facts: [string, string][] = [
    ["Company", r.orgName],
    ["Requested by", r.requestedBy],
    ["Requested", day(r.createdAt, true)],
    ["Environment", r.environment ?? "—"],
    ["Contact", r.contact ?? "—"],
    ["Preferred window", r.preferredStart ? `${day(r.preferredStart)} – ${day(r.preferredEnd)}` : "Flexible"],
    ["Scheduled", r.scheduledStart ? `${day(r.scheduledStart)} – ${day(r.scheduledEnd)}` : "—"],
    ["Assigned to", r.assignee ?? "—"],
    ["Findings raised", String(r.findings)],
  ]
  return (
    <div className="grid gap-8">
      <PageHeader
        title={`Test ${r.productName}`}
        description={<ToneBadge tone={TESTING_TONE[status]} dot>{TESTING_LABELS[status]}</ToneBadge>}
        actions={
          <>
            {status === "submitted" && (
              <>
                <AdminAction variant="default" label="Accept" pendingLabel="Accepting…" success="Accepted and assigned to you." action={advanceTestingAction.bind(null, r.id, "accept")} />
                <AdminAction
                  variant="destructive"
                  label="Decline"
                  pendingLabel="Declining…"
                  success="Declined. The Owner can see your note."
                  note={{ label: "Why is it declined?", placeholder: "Shown to the Owner.", confirm: "Decline request" }}
                  action={advanceTestingAction.bind(null, r.id, "decline")}
                />
              </>
            )}
            {(status === "accepted" || status === "scheduled") && (
              <AdminAction variant="default" label="Start testing" pendingLabel="Starting…" success="Testing started. Findings you raise in their console are linked to this request." action={advanceTestingAction.bind(null, r.id, "start")} />
            )}
            {status === "in_progress" && (
              <AdminAction
                variant="default"
                label="Complete"
                pendingLabel="Completing…"
                success="Completed. The Owner has been emailed."
                note={{ label: "Summary for the Owner", placeholder: "e.g. 3 findings raised; close-out report saved.", confirm: "Mark complete" }}
                action={advanceTestingAction.bind(null, r.id, "complete")}
              />
            )}
            {["accepted", "scheduled", "in_progress", "completed"].includes(status) && (
              <Button asChild variant="outline" size="sm">
                <Link href={`/o/${r.orgSlug}/products/${r.productSlug}`}>
                  Open product
                  <ExternalLinkIcon data-icon="inline-end" />
                </Link>
              </Button>
            )}
          </>
        }
      />
      <section className="grid gap-2 rounded-3xl p-5 ring-1 ring-foreground/10">
        <h2 className="text-sm font-medium text-muted-foreground">Scope</h2>
        <p className="text-sm whitespace-pre-wrap">{r.scope}</p>
        {r.notes && (
          <>
            <h2 className="mt-3 text-sm font-medium text-muted-foreground">Notes</h2>
            <p className="text-sm whitespace-pre-wrap">{r.notes}</p>
          </>
        )}
        {r.decisionNote && (
          <>
            <h2 className="mt-3 text-sm font-medium text-muted-foreground">Our note</h2>
            <p className="text-sm whitespace-pre-wrap">{r.decisionNote}</p>
          </>
        )}
      </section>
      <dl className="grid gap-x-8 gap-y-3 rounded-3xl p-5 ring-1 ring-foreground/10 sm:grid-cols-2 lg:grid-cols-3">
        {facts.map(([k, v]) => (
          <div key={k} className="grid gap-0.5">
            <dt className="text-xs text-muted-foreground">{k}</dt>
            <dd className="text-sm">{v}</dd>
          </div>
        ))}
      </dl>
      {(status === "accepted" || status === "scheduled") && (
        <section className="grid gap-2">
          <h2 className="text-base font-semibold tracking-tight">Testing window</h2>
          <ScheduleForm id={r.id} start={r.scheduledStart ?? ""} end={r.scheduledEnd ?? ""} />
        </section>
      )}
    </div>
  )
}
