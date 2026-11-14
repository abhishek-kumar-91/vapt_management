"use client"

import * as React from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { ArrowLeftIcon, PlusIcon } from "lucide-react"

import { ActivityFeed } from "@/components/activity-feed"
import { CloseoutMeter, MeterLegend } from "@/components/closeout-meter"
import { FindingFormSheet } from "@/components/findings/finding-form-sheet"
import { FindingsTable } from "@/components/findings/findings-table"
import { PageHeader } from "@/components/page-header"
import { ProductAvatar } from "@/components/product-avatar"
import { AreaList } from "@/components/products/area-list"
import { CyclePlan } from "@/components/products/cycle-plan"
import { ProductRegister } from "@/components/products/product-register"
import { HealthBadge, SeverityCounts } from "@/components/status"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { isClosed, metricsFor } from "@/lib/metrics"
import { useDashboard } from "@/lib/store"
import { useOrgPath } from "@/components/current-user"

function Stat({
  label,
  value,
  note,
}: {
  label: string
  value: React.ReactNode
  note?: React.ReactNode
}) {
  return (
    <div className="grid content-start gap-1">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-2xl font-semibold tracking-tight tabular">
        {value}
      </span>
      {note && <span className="text-xs text-muted-foreground">{note}</span>}
    </div>
  )
}

export default function ProductPage() {
  const to = useOrgPath()
  const { id } = useParams<{ id: string }>()
  const { products, findings, data } = useDashboard()
  const product = products.find((p) => p.id === decodeURIComponent(id))
  const [formOpen, setFormOpen] = React.useState(false)
  const [findingView, setFindingView] = React.useState("open")

  if (!product) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>Product not found</EmptyTitle>
          <EmptyDescription>
            There’s no product with the ID “{id}” in this browser’s data.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button asChild variant="outline">
            <Link href={to("")}>Back to overview</Link>
          </Button>
        </EmptyContent>
      </Empty>
    )
  }

  const m = metricsFor(product, findings)
  const productFindings = m.findings.filter((f) =>
    findingView === "open"
      ? !isClosed(f)
      : findingView === "closed"
        ? isClosed(f)
        : true
  )
  const events = data.events
    .filter((e) => e.product === product.id)
    .sort((a, b) => b.date.localeCompare(a.date))

  return (
    <div className="grid gap-6">
      <Button
        variant="ghost"
        size="sm"
        asChild
        className="-ml-2 w-fit text-muted-foreground"
      >
        <Link href={to("")}>
          <ArrowLeftIcon data-icon="inline-start" />
          All products
        </Link>
      </Button>

      <PageHeader
        leading={
          <ProductAvatar id={product.id} name={product.name} size="lg" />
        }
        title={product.name}
        description={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span>Tier {product.tier}</span>
            <span aria-hidden>·</span>
            <span>{product.status}</span>
            <span aria-hidden>·</span>
            <span>{product.domain || "Domain not specified"}</span>
            <span aria-hidden>·</span>
            <span>{product.owner || "Owner not specified"}</span>
          </span>
        }
        actions={
          <>
            <HealthBadge health={m.health} className="h-7 px-3 text-sm" />
            <Button onClick={() => setFormOpen(true)}>
              <PlusIcon data-icon="inline-start" />
              Report finding
            </Button>
          </>
        }
      />

      <Card>
        <CardContent className="grid gap-8 lg:grid-cols-[minmax(0,1.3fr)_auto_minmax(0,1fr)]">
          <div className="grid content-start gap-4">
            <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-1">
              <Stat label="Overall coverage" value={`${m.coverage}%`} />
              <span className="pb-1 text-sm text-muted-foreground tabular">
                <span className="font-medium text-foreground">{m.tested}</span>{" "}
                of {m.areas} areas tested
                {product.status === "In progress" && <> · plan {m.planned}%</>}
              </span>
            </div>
            <CloseoutMeter counts={m.counts} size="lg" />
            <MeterLegend />
          </div>
          <Separator orientation="vertical" className="hidden lg:block" />
          <div className="grid grid-cols-3 gap-4">
            <Stat
              label="High-risk"
              value={`${m.priorityCoverage}%`}
              note={`${m.priorityTested}/${m.highRisk} priority areas`}
            />
            <Stat
              label="Open findings"
              value={m.open.length}
              note={
                <SeverityCounts
                  count={m.count}
                  className="grid w-fit grid-cols-2 gap-y-0.5"
                />
              }
            />
            <Stat
              label="Risk score"
              value={m.risk.toFixed(1)}
              note={`Tier ${product.tier} weighted`}
            />
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="areas" className="gap-4">
        <TabsList className="max-w-full justify-start overflow-x-auto">
          <TabsTrigger value="areas">Test areas</TabsTrigger>
          <TabsTrigger value="findings" className="gap-1.5">
            Findings{" "}
            <span className="text-xs text-muted-foreground tabular">
              {m.open.length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="cycles">Test cycles</TabsTrigger>
          <TabsTrigger value="register">Register</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="areas">
          <Card>
            <CardHeader>
              <CardTitle>Coverage by test area</CardTitle>
              <CardDescription>
                SOP §7 test plan · {m.tested} of {m.areas} tested
              </CardDescription>
            </CardHeader>
            <CardContent className="px-3 sm:px-4">
              <AreaList product={product} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="findings">
          <Card className="gap-4">
            <CardHeader className="flex flex-wrap items-center justify-between gap-3">
              <div className="grid gap-1.5">
                <CardTitle>Vulnerability register</CardTitle>
                <CardDescription>
                  Critical/High findings need same-day escalation. Exit statuses
                  need a reason.
                </CardDescription>
              </div>
              <Tabs
                value={findingView}
                onValueChange={setFindingView}
                controls="product-findings"
              >
                <TabsList>
                  <TabsTrigger value="open">Open</TabsTrigger>
                  <TabsTrigger value="closed">Closed</TabsTrigger>
                  <TabsTrigger value="all">All</TabsTrigger>
                </TabsList>
              </Tabs>
            </CardHeader>
            <CardContent id="product-findings" className="px-0">
              <FindingsTable
                findings={productFindings}
                showProduct={false}
                resetKey={findingView}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cycles">
          <Card>
            <CardHeader>
              <CardTitle>Test cycle plan</CardTitle>
              <CardDescription>
                SOP §11–13 schedule for tier {product.tier}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CyclePlan product={product} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="register">
          <Card>
            <CardHeader>
              <CardTitle>Engagement and product status</CardTitle>
              <CardDescription>SOP §6–7, §13 product register</CardDescription>
            </CardHeader>
            <CardContent>
              <ProductRegister product={product} metrics={m} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Product history</CardTitle>
              <CardDescription>{events.length} events</CardDescription>
            </CardHeader>
            <CardContent>
              <ActivityFeed events={events} showProduct={false} longDates />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <FindingFormSheet
        open={formOpen}
        onOpenChange={setFormOpen}
        productId={product.id}
      />
    </div>
  )
}
