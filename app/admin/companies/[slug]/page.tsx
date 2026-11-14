import Link from "next/link"
import { notFound } from "next/navigation"
import { ExternalLinkIcon } from "lucide-react"

import { reviewCompanyAction, setCompanyStatusAction } from "@/app/admin/actions"
import { AdminAction } from "@/components/admin/admin-action"
import { day, EmptyRow, OrgStatusBadge } from "@/components/admin/bits"
import { PageHeader, SectionHeading } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
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

export default async function CompanyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const data = await getCompany(slug)
  if (!data) notFound()
  const { org, stats, members, products, history } = data

  const actions =
    org.status === "pending_review" ? (
      <>
        <AdminAction
          variant="default"
          label="Approve"
          pendingLabel="Approving…"
          success={`${org.name} is approved. The Owner has been emailed.`}
          action={reviewCompanyAction.bind(null, slug, "approve")}
        />
        <AdminAction
          label="Request changes"
          pendingLabel="Sending…"
          success="Sent back to the Owner with your note."
          note={{ label: "What should they change?", placeholder: "e.g. Use your company’s legal name and add your main web app.", confirm: "Send back" }}
          action={reviewCompanyAction.bind(null, slug, "changes")}
        />
        <AdminAction
          variant="destructive"
          label="Reject"
          pendingLabel="Rejecting…"
          success="Rejected. The Owner can see your reason and resubmit."
          note={{ label: "Why isn’t it approved?", placeholder: "Shown to the Owner.", confirm: "Reject company" }}
          action={reviewCompanyAction.bind(null, slug, "reject")}
        />
      </>
    ) : (
      <>
        {(org.status === "active" || org.status === "suspended") && (
          <Button asChild variant="outline" size="sm">
            <Link href={`/o/${slug}`}>
              Open console
              <ExternalLinkIcon data-icon="inline-end" />
            </Link>
          </Button>
        )}
        {org.status === "active" && (
          <AdminAction
            label="Suspend"
            pendingLabel="Suspending…"
            success={`${org.name} is suspended. Members can’t open it until it’s reactivated.`}
            action={setCompanyStatusAction.bind(null, slug, "suspended")}
          />
        )}
        {org.status === "suspended" && (
          <AdminAction
            variant="default"
            label="Reactivate"
            pendingLabel="Reactivating…"
            success={`${org.name} is active again.`}
            action={setCompanyStatusAction.bind(null, slug, "active")}
          />
        )}
        {org.status !== "closed" && org.status !== "draft" && (
          <AdminAction
            variant="destructive"
            label="Close"
            pendingLabel="Closing…"
            success={`${org.name} is closed. Its data is kept.`}
            note={{ label: "Why is it being closed?", placeholder: "Recorded in the audit log.", confirm: "Close company" }}
            action={setCompanyStatusAction.bind(null, slug, "closed")}
          />
        )}
      </>
    )

  const facts = [
    ["Address", `/o/${org.slug}`],
    ["Industry", org.industry ?? "—"],
    ["Size", org.size ?? "—"],
    ["Website", org.website ?? "—"],
    ["Finding prefix", org.findingPrefix],
    ["Created", day(org.createdAt)],
    ["Submitted", day(org.submittedAt, true)],
    ["Reviewed", day(org.reviewedAt, true)],
  ]

  return (
    <div className="grid gap-8">
      <PageHeader
        title={org.name}
        description={<OrgStatusBadge status={org.status} />}
        actions={actions}
      />
      {org.reviewNote && (
        <p className="rounded-2xl bg-muted px-4 py-3 text-sm">
          <span className="font-medium">Last review note: </span>
          {org.reviewNote}
        </p>
      )}

      <dl className="grid gap-x-8 gap-y-3 rounded-3xl p-5 ring-1 ring-foreground/10 sm:grid-cols-2 lg:grid-cols-4">
        {facts.map(([k, v]) => (
          <div key={k} className="grid gap-0.5">
            <dt className="text-xs text-muted-foreground">{k}</dt>
            <dd className="truncate text-sm">{v}</dd>
          </div>
        ))}
        {stats && (
          <div className="grid gap-0.5 sm:col-span-2 lg:col-span-4">
            <dt className="text-xs text-muted-foreground">Open findings</dt>
            <dd className="text-sm tabular">
              {stats.openTotal} open · {stats.openCritical} critical · {stats.openHigh} high · {stats.overdue} past deadline
            </dd>
          </div>
        )}
      </dl>

      <section className="grid gap-3">
        <SectionHeading title="Products" description={`${products.length} registered`} />
        <Card className="gap-0 py-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-6">Product</TableHead>
                <TableHead>Tier</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="pr-6">Data · technology</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((p) => (
                <TableRow key={p.slug}>
                  <TableCell className="pl-6">
                    <span className="grid leading-tight">
                      <span className="font-medium">{p.name}{p.archivedAt ? " (archived)" : ""}</span>
                      <span className="text-xs text-muted-foreground">{p.domain ?? ""}</span>
                    </span>
                  </TableCell>
                  <TableCell>Tier {p.tier}</TableCell>
                  <TableCell>{p.status}</TableCell>
                  <TableCell className="pr-6 text-muted-foreground">{[p.dataSensitivity, p.technology].filter(Boolean).join(" · ") || "—"}</TableCell>
                </TableRow>
              ))}
              {!products.length && <EmptyRow cols={4}>No products yet.</EmptyRow>}
            </TableBody>
          </Table>
        </Card>
      </section>

      <section className="grid gap-3">
        <SectionHeading title="People" description={`${members.length} ${members.length === 1 ? "member" : "members"}`} />
        <Card className="gap-0 py-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-6">Person</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="pr-6">Last sign-in</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="pl-6">
                    <span className="grid leading-tight">
                      <span className="font-medium">{m.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {m.email}{m.verified ? "" : " · email not confirmed"}
                      </span>
                    </span>
                  </TableCell>
                  <TableCell>{ROLE_LABELS[m.role]}</TableCell>
                  <TableCell className="capitalize">{m.status}</TableCell>
                  <TableCell className="pr-6">{day(m.lastLoginAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </section>

      <section className="grid gap-3">
        <SectionHeading title="History" />
        <ol className="grid divide-y rounded-3xl ring-1 ring-foreground/10">
          {history.map((h, i) => (
            <li key={i} className="flex flex-wrap items-baseline gap-x-3 px-5 py-3 text-sm">
              <span className="font-medium">{HISTORY[h.action] ?? h.action}</span>
              <span className="text-muted-foreground">
                {h.actor ?? "System"}{h.actorPlatform ? " (Pentest Scout)" : ""}
              </span>
              <span className="ml-auto text-muted-foreground tabular">{day(h.at, true)}</span>
            </li>
          ))}
          {!history.length && <li className="px-5 py-6 text-sm text-muted-foreground">No history yet.</li>}
        </ol>
      </section>
    </div>
  )
}
