"use client"

import * as React from "react"
import Link from "next/link"
import { ArrowRightIcon, PlusIcon } from "lucide-react"

import { ActivityFeed } from "@/components/activity-feed"
import { ActionQueue } from "@/components/overview/action-queue"
import { CoverageChart, FindingsChart } from "@/components/overview/charts"
import { PortfolioSummary } from "@/components/overview/portfolio-summary"
import { ProductTable } from "@/components/overview/product-table"
import { UpcomingCycles } from "@/components/overview/upcoming-cycles"
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
import { formatDate, LONG_DATE } from "@/lib/dates"
import { useDashboard } from "@/lib/store"

export default function OverviewPage() {
  const { data, products, findings } = useDashboard()
  const [search, setSearch] = React.useState("")
  const [tier, setTier] = React.useState("all")

  const visible = products.filter(
    (p) =>
      (tier === "all" || String(p.tier) === tier) &&
      `${p.name} ${p.domain || ""} ${p.id}`
        .toLowerCase()
        .includes(search.trim().toLowerCase())
  )
  const names = Object.fromEntries(products.map((p) => [p.id, p.name]))
  const recent = [...data.events]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 6)

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Overview"
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            Testing progress, remediation and product risk across the portfolio.
            <ToneBadge tone="warning" dot>
              Data as of {formatDate(data.generated, LONG_DATE)}
            </ToneBadge>
          </span>
        }
        actions={
          <Button asChild>
            <Link href="/dashboard/findings?new=1">
              <PlusIcon data-icon="inline-start" />
              Report finding
            </Link>
          </Button>
        }
      />

      <PortfolioSummary products={products} findings={findings} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <ActionQueue data={data} findings={findings} />
        <UpcomingCycles products={products} />
      </div>

      <ProductTable
        products={visible}
        findings={findings}
        search={search}
        onSearch={setSearch}
        tier={tier}
        onTier={setTier}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <FindingsChart products={visible} findings={findings} />
        <CoverageChart products={visible} history={data.history || []} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent activity</CardTitle>
          <CardDescription>Audit trail across all products</CardDescription>
          <CardAction>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/dashboard/activity">
                Activity log <ArrowRightIcon data-icon="inline-end" />
              </Link>
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          <ActivityFeed events={recent} productNames={names} />
        </CardContent>
      </Card>
    </div>
  )
}
