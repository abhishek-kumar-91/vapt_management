import Link from "next/link"
import {
  ArrowRightIcon,
  BadgeCheckIcon,
  CheckCircle2Icon,
  FlaskConicalIcon,
  MailIcon,
  UserPlusIcon,
} from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { ToneBadge } from "@/components/status"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { overview } from "@/server/admin"

export const metadata = { title: "Overview" }

const plural = (n: number, one: string, many = `${one}s`) =>
  `${n} ${n === 1 ? one : many}`

function Stat({ label, value, children }: { label: string; value: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="grid content-start gap-1.5">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-3xl font-semibold tracking-tight tabular">{value}</span>
      {children && <div className="text-xs text-muted-foreground">{children}</div>}
    </div>
  )
}

export default async function AdminOverview() {
  const o = await overview()
  const active = o.byStatus.active ?? 0
  const waiting = o.byStatus.pending_review ?? 0
  const setup = (o.byStatus.draft ?? 0) + (o.byStatus.rejected ?? 0)
  const queue = [
    { label: "Companies waiting for review", value: waiting, href: "/admin/approvals", icon: BadgeCheckIcon },
    { label: "Testing requests to answer", value: o.requests, href: "/admin/testing", icon: FlaskConicalIcon },
    { label: "Emails with links to send by hand", value: o.outbox, href: "/admin/outbox", icon: MailIcon },
    { label: "Sign-ups that haven’t confirmed their email", value: o.funnel.unverified, href: "/admin/signups", icon: UserPlusIcon },
  ]
  const work = queue.filter((q) => q.value > 0)

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Overview"
        description={`${plural(o.funnel.signedUp7d, "sign-up")} in the last 7 days`}
      />

      <Card>
        <CardContent className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1.4fr)]">
          <div className="grid content-start gap-3">
            <Stat label="Active companies" value={active} />
            <p className="text-sm text-muted-foreground tabular">
              <span className="font-medium text-foreground">{waiting}</span> waiting for review ·{" "}
              {setup} setting up
              {o.byStatus.suspended ? <> · {o.byStatus.suspended} suspended</> : null}
            </p>
            <p className="text-sm text-muted-foreground tabular">
              {plural(o.totals.products, "product")} tracked by{" "}
              {plural(o.totals.members, "person", "people")}
            </p>
          </div>

          <Separator orientation="vertical" className="hidden lg:block" />

          <div className="grid gap-4 sm:grid-cols-3">
            <Stat label="Open findings" value={o.totals.open}>
              <span className="tabular">
                <span className="font-medium text-critical">{o.totals.critical} Critical</span> ·{" "}
                {o.totals.high} High
              </span>
            </Stat>
            <Stat label="Past fix deadline" value={o.totals.overdue}>
              Across every company
            </Stat>
            <Stat label="Testing requests" value={o.requests}>
              {o.requests ? "Waiting for an answer" : "None waiting"}
            </Stat>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Needs you</CardTitle>
            <CardDescription>Work waiting on a Pentest Scout admin</CardDescription>
          </CardHeader>
          <CardContent className="px-3">
            {work.length ? (
              <ul className="grid gap-0.5">
                {work.map((q) => (
                  <li key={q.label}>
                    <Link
                      href={q.href}
                      className="flex items-center gap-3 rounded-3xl px-3 py-2.5 transition-colors outline-none hover:bg-muted/70 focus-visible:ring-3 focus-visible:ring-ring/30"
                    >
                      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
                        <q.icon className="size-4" />
                      </span>
                      <span className="flex-1 text-sm font-medium">{q.label}</span>
                      <span className="text-sm font-semibold tabular">{q.value}</span>
                      <ArrowRightIcon className="size-4 text-muted-foreground" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex items-center gap-3 rounded-3xl bg-success/10 px-4 py-5 text-sm">
                <CheckCircle2Icon className="size-5 text-success" />
                <span>Nothing waiting. Approvals, testing requests and the outbox are clear.</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Open risk</CardTitle>
            <CardDescription>Companies with open Critical findings or missed deadlines</CardDescription>
            <CardAction>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/admin/companies?status=active">
                  All companies <ArrowRightIcon data-icon="inline-end" />
                </Link>
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent className="px-3">
            {o.hotspots.length ? (
              <ul className="grid gap-0.5">
                {o.hotspots.map((h) => (
                  <li key={h.slug}>
                    <Link
                      href={`/admin/companies/${h.slug}`}
                      className="flex items-center gap-3 rounded-3xl px-3 py-2.5 transition-colors outline-none hover:bg-muted/70 focus-visible:ring-3 focus-visible:ring-ring/30"
                    >
                      <span className="flex-1 truncate text-sm font-medium">{h.name}</span>
                      {h.openCritical > 0 && <ToneBadge tone="critical">{h.openCritical} Critical</ToneBadge>}
                      {h.openHigh > 0 && <ToneBadge tone="high">{h.openHigh} High</ToneBadge>}
                      {h.overdue > 0 && <ToneBadge tone="warning">{h.overdue} overdue</ToneBadge>}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex items-center gap-3 rounded-3xl bg-success/10 px-4 py-5 text-sm">
                <CheckCircle2Icon className="size-5 text-success" />
                <span>No company has open Critical findings or missed deadlines.</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
