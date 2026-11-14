import Link from "next/link"
import { ArrowRightIcon } from "lucide-react"

import { EmptyRow } from "@/components/admin/bits"
import { PageHeader, SectionHeading } from "@/components/page-header"
import { Card } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { overview } from "@/server/admin"

export const metadata = { title: "Overview" }

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`


export default async function AdminOverview() {
  const o = await overview()
  const figures = [
    { label: "Active companies", value: o.byStatus.active ?? 0, href: "/admin/companies?status=active" },
    { label: "Open findings", value: o.totals.open, href: "/admin/products" },
    { label: "Open critical", value: o.totals.critical, href: "/admin/companies?status=active" },
    { label: "Past fix deadline", value: o.totals.overdue, href: "/admin/companies?status=active" },
  ]
  const queue = [
    { label: "Companies waiting for review", value: o.byStatus.pending_review ?? 0, href: "/admin/approvals" },
    { label: "Testing requests to answer", value: o.requests, href: "/admin/testing" },
    { label: "Emails with links to send by hand", value: o.outbox, href: "/admin/outbox" },
    { label: "Sign-ups that haven’t confirmed their email", value: o.funnel.unverified, href: "/admin/signups" },
  ]
  return (
    <div className="grid gap-8">
      <PageHeader
        title="Overview"
        description={`${plural(o.funnel.signedUp7d, "sign-up")} this week · ${plural(o.totals.products, "product")} tracked · ${plural(o.totals.members, "person", "people")} across all companies`}
      />

      <dl className="grid grid-cols-2 divide-x divide-y rounded-3xl ring-1 ring-foreground/10 md:grid-cols-4 md:divide-y-0">
        {figures.map((f) => (
          <Link key={f.label} href={f.href} className="grid gap-1 px-5 py-4 outline-none first:rounded-l-3xl last:rounded-r-3xl hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/30">
            <dt className="text-sm text-muted-foreground">{f.label}</dt>
            <dd className="text-2xl font-semibold tracking-tight tabular">{f.value}</dd>
          </Link>
        ))}
      </dl>

      <section className="grid gap-3">
        <SectionHeading title="Needs you" description="Work waiting on a Pentest Scout admin." />
        <ul className="grid divide-y rounded-3xl ring-1 ring-foreground/10">
          {queue.map((q) => (
            <li key={q.label}>
              <Link href={q.href} className="flex items-center gap-3 px-5 py-3.5 outline-none hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/30">
                <span className="flex-1 text-sm">{q.label}</span>
                <span className={q.value ? "font-semibold tabular" : "text-muted-foreground tabular"}>{q.value}</span>
                <ArrowRightIcon className="size-4 text-muted-foreground" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="grid gap-3">
        <SectionHeading title="Companies with open risk" description="Open critical findings first, then most overdue." />
        <Card className="gap-0 py-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-6">Company</TableHead>
                <TableHead className="text-right">Critical</TableHead>
                <TableHead className="text-right">High</TableHead>
                <TableHead className="pr-6 text-right">Overdue</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {o.hotspots.map((h) => (
                <TableRow key={h.slug}>
                  <TableCell className="pl-6">
                    <Link href={`/admin/companies/${h.slug}`} className="font-medium hover:underline">{h.name}</Link>
                  </TableCell>
                  <TableCell className="text-right tabular">{h.openCritical}</TableCell>
                  <TableCell className="text-right tabular">{h.openHigh}</TableCell>
                  <TableCell className="pr-6 text-right tabular">{h.overdue}</TableCell>
                </TableRow>
              ))}
              {!o.hotspots.length && <EmptyRow cols={4}>No company has open critical or overdue findings.</EmptyRow>}
            </TableBody>
          </Table>
        </Card>
      </section>
    </div>
  )
}
