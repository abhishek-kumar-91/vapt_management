import Link from "next/link"
import { notFound } from "next/navigation"
import { ExternalLinkIcon, MessageSquareTextIcon } from "lucide-react"

import { advanceTestingAction } from "@/app/admin/actions"
import { day } from "@/components/admin/bits"
import { PageHeader } from "@/components/page-header"
import { RunAction } from "@/components/run-action"
import { ToneBadge } from "@/components/status"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TESTING_LABELS, TESTING_TONE, type TestingStatus } from "@/lib/testing"
import { getRequest } from "@/server/testing"

export const metadata = { title: "Testing request" }

export default async function AdminTestingRequestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const r = await getRequest(id)
  if (!r) notFound()
  const status = r.status as TestingStatus
  const window = r.scheduledStart ? `${day(r.scheduledStart)} – ${day(r.scheduledEnd)}` : null
  const facts: [string, string][] = [
    ["Company", r.orgName],
    ["Requested by", r.requestedBy],
    ["Requested", day(r.createdAt, true)],
    ["Environment", r.environment ?? "—"],
    ["Contact", r.contact ?? "—"],
    ["Preferred window", r.preferredStart ? `${day(r.preferredStart)} – ${day(r.preferredEnd)}` : "Flexible"],
    ["Scheduled", window ?? "Not yet"],
    ["Assigned to", r.assignee ?? "Unassigned"],
    ["Findings raised", String(r.findings)],
  ]
  const live = ["accepted", "scheduled", "in_progress", "completed"].includes(status)

  return (
    <div className="grid gap-6">
      <PageHeader
        title={`Test ${r.productName}`}
        description={
          <ToneBadge tone={TESTING_TONE[status]} dot>
            {TESTING_LABELS[status]}
          </ToneBadge>
        }
        actions={
          <>
            {status === "submitted" && (
              <>
                <RunAction
                  variant="destructive"
                  label="Decline"
                  pendingLabel="Declining…"
                  success="Declined. The Owner can see your note."
                  confirm={{
                    title: "Decline this request?",
                    description: `${r.orgName} sees your note and can send a new request.`,
                    confirmLabel: "Decline request",
                    destructive: true,
                    note: { label: "Why is it declined?", placeholder: "Shown to the Owner.", required: true },
                  }}
                  action={advanceTestingAction.bind(null, r.id, "decline")}
                />
                <RunAction
                  variant="default"
                  label="Accept"
                  pendingLabel="Accepting…"
                  success="Accepted and assigned to you. The Owner has been emailed."
                  action={advanceTestingAction.bind(null, r.id, "accept")}
                />
              </>
            )}
            {(status === "accepted" || status === "scheduled") && (
              <>
                <RunAction
                  label={window ? "Reschedule" : "Schedule"}
                  pendingLabel="Saving…"
                  success="Scheduled. The Owner has been emailed."
                  confirm={{
                    title: window ? "Move the testing window" : "Schedule testing",
                    description: "The Owner gets an email with the dates.",
                    confirmLabel: "Save dates",
                    dates: { start: r.scheduledStart ?? r.preferredStart ?? "", end: r.scheduledEnd ?? r.preferredEnd ?? "" },
                  }}
                  action={advanceTestingAction.bind(null, r.id, "schedule")}
                />
                <RunAction
                  variant="default"
                  label="Start testing"
                  pendingLabel="Starting…"
                  success="Testing started. Findings you raise in their console are linked to this request."
                  action={advanceTestingAction.bind(null, r.id, "start")}
                />
              </>
            )}
            {status === "in_progress" && (
              <RunAction
                variant="default"
                label="Complete"
                pendingLabel="Completing…"
                success="Completed. The Owner has been emailed."
                confirm={{
                  title: "Complete this engagement?",
                  description: "The Owner is emailed and the company’s activity log records it.",
                  confirmLabel: "Mark complete",
                  note: { label: "Summary for the Owner", placeholder: "e.g. 3 findings raised; close-out report saved." },
                }}
                action={advanceTestingAction.bind(null, r.id, "complete")}
              />
            )}
            {live && (
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

      {r.decisionNote && (
        <Alert>
          <MessageSquareTextIcon />
          <AlertTitle>Note to the company</AlertTitle>
          <AlertDescription>{r.decisionNote}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>What to test</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 text-sm">
            <p className="whitespace-pre-wrap">{r.scope}</p>
            {r.notes && (
              <div className="grid gap-1">
                <span className="text-xs text-muted-foreground">Notes from the company</span>
                <p className="whitespace-pre-wrap">{r.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
              {facts.map(([k, v]) => (
                <div key={k} className="grid gap-0.5">
                  <dt className="text-xs text-muted-foreground">{k}</dt>
                  <dd className="text-sm">{v}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
