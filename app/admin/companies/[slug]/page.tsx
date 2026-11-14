import Link from "next/link"
import { notFound } from "next/navigation"
import { ExternalLinkIcon, MessageSquareTextIcon } from "lucide-react"

import { reviewCompanyAction, setCompanyStatusAction } from "@/app/admin/actions"
import { day, OrgStatusBadge } from "@/components/admin/bits"
import { EmptyRow, PersonCell } from "@/components/list-card"
import { PageHeader } from "@/components/page-header"
import { ProductAvatar } from "@/components/product-avatar"
import { RunAction } from "@/components/run-action"
import { ToneBadge } from "@/components/status"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ROLE_LABELS } from "@/lib/auth/roles"
import { getCompany } from "@/server/admin"

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const data = await getCompany((await params).slug)
  return { title: data?.org.name ?? "Company" }
}

const HISTORY: Record<string, string> = {
  "org.created": "Company created",
  "org.updated": "Details edited",
  "org.submitted": "Submitted for review",
  "org.approved": "Approved",
  "org.rejected": "Not approved",
  "org.changes_requested": "Changes requested",
  "org.suspended": "Suspended",
  "org.reactivated": "Reactivated",
  "org.closed": "Closed",
  "org.settings_changed": "Settings changed",
}

const MEMBER_TONE = { active: "success", invited: "neutral", suspended: "paused", removed: "neutral" } as const

export default async function CompanyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const data = await getCompany(slug)
  if (!data) notFound()
  const { org, stats, members, products, history } = data

  const actions =
    org.status === "pending_review" ? (
      <>
        <RunAction
          variant="destructive"
          label="Reject"
          pendingLabel="Rejecting…"
          success="Rejected. The Owner can see your reason and resubmit."
          confirm={{
            title: `Reject ${org.name}?`,
            description: "The Owner sees your reason and can edit the company and submit it again.",
            confirmLabel: "Reject company",
            destructive: true,
            note: { label: "Reason", placeholder: "Shown to the Owner.", required: true },
          }}
          action={reviewCompanyAction.bind(null, slug, "reject")}
        />
        <RunAction
          label="Request changes"
          pendingLabel="Sending…"
          success="Sent back to the Owner with your note."
          confirm={{
            title: "Ask for changes",
            description: "The company goes back to setup with your note. The Owner resubmits when it’s done.",
            confirmLabel: "Send back",
            note: { label: "What should they change?", placeholder: "e.g. Use the company’s legal name and add the main web app.", required: true },
          }}
          action={reviewCompanyAction.bind(null, slug, "changes")}
        />
        <RunAction
          variant="default"
          label="Approve"
          pendingLabel="Approving…"
          success={`${org.name} is approved. The Owner has been emailed.`}
          confirm={{
            title: `Approve ${org.name}?`,
            description: "The company goes live and its Owner can invite their team.",
            confirmLabel: "Approve",
          }}
          action={reviewCompanyAction.bind(null, slug, "approve")}
        />
      </>
    ) : (
      <>
        {org.status !== "closed" && org.status !== "draft" && (
          <RunAction
            variant="ghost"
            label="Close"
            pendingLabel="Closing…"
            success={`${org.name} is closed. Its data is kept.`}
            confirm={{
              title: `Close ${org.name}?`,
              description: "Members lose access. All data is kept and the company can’t be reopened from here.",
              confirmLabel: "Close company",
              destructive: true,
              note: { label: "Reason", placeholder: "Recorded in the audit log.", required: true },
            }}
            action={setCompanyStatusAction.bind(null, slug, "closed")}
          />
        )}
        {org.status === "active" && (
          <RunAction
            label="Suspend"
            pendingLabel="Suspending…"
            success={`${org.name} is suspended.`}
            confirm={{
              title: `Suspend ${org.name}?`,
              description: "Members can’t open the company until it’s reactivated. Nothing is deleted.",
              confirmLabel: "Suspend",
              destructive: true,
            }}
            action={setCompanyStatusAction.bind(null, slug, "suspended")}
          />
        )}
        {org.status === "suspended" && (
          <RunAction
            label="Reactivate"
            pendingLabel="Reactivating…"
            success={`${org.name} is active again.`}
            action={setCompanyStatusAction.bind(null, slug, "active")}
          />
        )}
        {(org.status === "active" || org.status === "suspended") && (
          <Button asChild size="sm">
            <Link href={`/o/${slug}`}>
              Open console
              <ExternalLinkIcon data-icon="inline-end" />
            </Link>
          </Button>
        )}
      </>
    )

  const facts: [string, React.ReactNode][] = [
    ["Address", `/o/${org.slug}`],
    ["Industry", org.industry ?? "—"],
    ["Size", org.size ?? "—"],
    ["Website", org.website ?? "—"],
    ["Finding prefix", <span key="p" className="font-mono">{org.findingPrefix}</span>],
    ["Created", day(org.createdAt)],
    ["Submitted", day(org.submittedAt, true)],
    ["Reviewed", day(org.reviewedAt, true)],
  ]

  return (
    <div className="grid gap-6">
      <PageHeader title={org.name} description={<OrgStatusBadge status={org.status} />} actions={actions} />

      {org.reviewNote && (
        <Alert>
          <MessageSquareTextIcon />
          <AlertTitle>Last review note</AlertTitle>
          <AlertDescription>{org.reviewNote}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
          {stats && (
            <CardDescription className="tabular">
              {stats.openTotal} open findings · {stats.openCritical} Critical · {stats.openHigh} High ·{" "}
              {stats.overdue} past deadline
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>
          <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
            {facts.map(([k, v]) => (
              <div key={k} className="grid gap-0.5">
                <dt className="text-xs text-muted-foreground">{k}</dt>
                <dd className="truncate text-sm">{v}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="gap-1 pb-0">
          <CardHeader>
            <CardTitle>Products</CardTitle>
            <CardDescription>{products.length === 1 ? "1 product" : `${products.length} products`}</CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-6">Product</TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead className="pr-6">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((p) => (
                  <TableRow key={p.slug}>
                    <TableCell className="py-3 pl-6">
                      <div className="flex items-center gap-3">
                        <ProductAvatar id={p.slug} name={p.name} />
                        <span className="grid min-w-0 gap-0.5">
                          <span className="truncate font-medium">{p.name}</span>
                          <span className="truncate text-xs text-muted-foreground">
                            {[p.domain, p.dataSensitivity && `${p.dataSensitivity} sensitivity`].filter(Boolean).join(" · ") || "—"}
                          </span>
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="py-3">Tier {p.tier}</TableCell>
                    <TableCell className="py-3 pr-6">
                      {p.archivedAt ? <ToneBadge tone="neutral">Archived</ToneBadge> : p.status}
                    </TableCell>
                  </TableRow>
                ))}
                {!products.length && <EmptyRow cols={3} title="No products yet" />}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="gap-1 pb-0">
          <CardHeader>
            <CardTitle>People</CardTitle>
            <CardDescription>{members.length === 1 ? "1 member" : `${members.length} members`}</CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-6">Person</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="pr-6">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="py-3 pl-6">
                      <PersonCell
                        name={m.name}
                        detail={`${m.email}${m.verified ? "" : " · email not confirmed"}`}
                        muted={m.status !== "active"}
                      />
                    </TableCell>
                    <TableCell className="py-3">{ROLE_LABELS[m.role]}</TableCell>
                    <TableCell className="py-3 pr-6">
                      <ToneBadge tone={MEMBER_TONE[m.status]} dot>
                        {m.status === "invited" ? "Invite pending" : m.status[0].toUpperCase() + m.status.slice(1)}
                      </ToneBadge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>History</CardTitle>
          <CardDescription>Sign-up, review and status changes. Everything else is in the audit log.</CardDescription>
        </CardHeader>
        <CardContent className="px-3">
          {history.length ? (
            <ol className="grid gap-0.5">
              {history.map((h, i) => (
                <li key={i} className="flex flex-wrap items-baseline gap-x-3 rounded-3xl px-3 py-2.5 text-sm">
                  <span className="font-medium">{HISTORY[h.action] ?? h.action}</span>
                  <span className="text-muted-foreground">
                    {h.actor ?? "System"}
                    {h.actorPlatform ? " · Pentest Scout" : ""}
                  </span>
                  <span className="ml-auto text-muted-foreground tabular">{day(h.at, true)}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="px-3 py-4 text-sm text-muted-foreground">No history yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
