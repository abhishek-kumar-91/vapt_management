import { notFound } from "next/navigation"

import { cancelTestingRequestAction, createTestingRequestAction } from "@/app/o/[org]/actions"
import { ActionButton } from "@/components/auth/action-button"
import { day, EmptyRow } from "@/components/admin/bits"
import { ActionForm } from "@/components/forms/action-form"
import { PageHeader, SectionHeading } from "@/components/page-header"
import { ToneBadge } from "@/components/status"
import { Card } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { roleHas } from "@/lib/auth/roles"
import { getContext } from "@/server/context"
import { listProducts } from "@/server/products"
import { TESTING_LABELS, TESTING_TONE, type TestingStatus } from "@/lib/testing"
import { listCompanyRequests } from "@/server/testing"

export const metadata = { title: "Testing" }

/** Ask Pentest Scout to test a product, and follow each request. */
export default async function TestingPage({ params }: { params: Promise<{ org: string }> }) {
  const { org } = await params
  const ctx = await getContext(org)
  if (!ctx) notFound()
  const owner = roleHas(ctx.role, "testing.request")
  const [requests, productList] = await Promise.all([listCompanyRequests(ctx), owner ? listProducts(ctx) : []])
  return (
    <div className="grid gap-8">
      <PageHeader
        title="Testing by Pentest Scout"
        description="No testers on your team, or need an independent test? Ask Pentest Scout to test a product. Findings from the engagement appear in your console, marked as raised by Pentest Scout."
      />
      <Card className="gap-0 py-0">
        <Table className="min-w-[760px]">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-6">Product</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Dates</TableHead>
              <TableHead className="text-right">Findings</TableHead>
              <TableHead className="pr-6 text-right">Requested</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {requests.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="max-w-96 pl-6 whitespace-normal">
                  <span className="grid gap-0.5">
                    <span className="font-medium">{r.productName}</span>
                    <span className="line-clamp-2 text-xs text-muted-foreground">{r.scope}</span>
                    {r.decisionNote && <span className="text-xs">Pentest Scout: {r.decisionNote}</span>}
                  </span>
                </TableCell>
                <TableCell>
                  <ToneBadge tone={TESTING_TONE[r.status as TestingStatus]} dot>
                    {TESTING_LABELS[r.status as TestingStatus]}
                  </ToneBadge>
                </TableCell>
                <TableCell className="text-sm">
                  {r.scheduledStart
                    ? `${day(r.scheduledStart)} – ${day(r.scheduledEnd)}`
                    : r.preferredStart
                      ? `Preferred from ${day(r.preferredStart)}`
                      : "Flexible"}
                </TableCell>
                <TableCell className="text-right tabular">{r.findings}</TableCell>
                <TableCell className="pr-6">
                  <div className="flex items-center justify-end gap-2">
                    <span className="text-sm text-muted-foreground">{day(r.createdAt)}</span>
                    {owner && ["submitted", "accepted", "scheduled"].includes(r.status) && (
                      <ActionButton
                        action={cancelTestingRequestAction.bind(null, org, r.id)}
                        label="Cancel"
                        pendingLabel="Cancelling…"
                        variant="ghost"
                        size="sm"
                      />
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {!requests.length && <EmptyRow cols={5}>No testing requests yet.</EmptyRow>}
          </TableBody>
        </Table>
      </Card>

      {owner && (
        <section className="grid gap-4">
          <SectionHeading title="Request testing" description="Pentest Scout replies within one working day." />
          {productList.length ? (
            <ActionForm
              action={createTestingRequestAction.bind(null, org)}
              submitLabel="Send request"
              pendingLabel="Sending…"
              className="max-w-2xl rounded-3xl p-5 ring-1 ring-foreground/10"
              fields={[
                {
                  name: "product",
                  label: "Product",
                  type: "select",
                  options: [{ value: "", label: "Choose a product" }, ...productList.map((p) => ({ value: p.slug, label: p.name }))],
                },
                {
                  name: "scope",
                  label: "What should be tested",
                  type: "textarea",
                  maxLength: 4000,
                  placeholder: "e.g. The customer web app and its API: sign-in, payments and the admin panel.",
                },
                { name: "environment", label: "Environment (optional)", placeholder: "Staging: https://staging.company.com", half: true },
                { name: "contact", label: "Contact for access (optional)", placeholder: "Name and email", half: true },
                { name: "preferredStart", label: "Preferred start (optional)", type: "date", half: true },
                { name: "preferredEnd", label: "Preferred end (optional)", type: "date", half: true },
                { name: "notes", label: "Anything else (optional)", type: "textarea", maxLength: 4000 },
              ]}
            />
          ) : (
            <p className="text-sm text-muted-foreground">Add a product first, then request testing for it.</p>
          )}
        </section>
      )}
    </div>
  )
}
