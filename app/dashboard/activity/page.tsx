"use client"

import * as React from "react"

import { ActivityFeed } from "@/components/activity-feed"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useDashboard } from "@/lib/store"

export default function ActivityPage() {
  const { data, products } = useDashboard()
  const [type, setType] = React.useState("all")
  const [product, setProduct] = React.useState("all")
  const names = Object.fromEntries(products.map((p) => [p.id, p.name]))
  const types = [...new Set(data.events.map((e) => e.type))].sort()
  const events = [...data.events]
    .filter(
      (e) =>
        (type === "all" || e.type === type) &&
        (product === "all" || e.product === product)
    )
    .sort((a, b) => b.date.localeCompare(a.date))

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Activity log"
        description={`Audit trail of assessment events across the portfolio · ${data.events.length} events`}
        actions={
          <>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger aria-label="Filter by event type" className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All events</SelectItem>
                {types.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={product} onValueChange={setProduct}>
              <SelectTrigger aria-label="Filter by product" className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All products</SelectItem>
                {products.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        }
      />
      <Card>
        <CardContent>
          {events.length ? (
            <ActivityFeed events={events} productNames={names} longDates />
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No events match these filters.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
