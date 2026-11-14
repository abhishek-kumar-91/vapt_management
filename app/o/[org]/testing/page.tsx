import { notFound } from "next/navigation"
import { FlaskConicalIcon } from "lucide-react"

import { cancelTestingRequestAction, createTestingRequestAction } from "@/app/o/[org]/actions"
import { day } from "@/components/admin/bits"
import { FormSheet } from "@/components/forms/form-sheet"
import { EmptyRow, ListCard } from "@/components/list-card"
import { PageHeader } from "@/components/page-header"
import { ProductAvatar } from "@/components/product-avatar"
import { RunAction } from "@/components/run-action"
import { ToneBadge } from "@/components/status"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { roleHas } from "@/lib/auth/roles"
import { testingRequestFields } from "@/lib/form-specs"
import { TESTING_LABELS, TESTING_TONE, type TestingStatus } from "@/lib/testing"
import { getContext } from "@/server/context"
import { listProducts } from "@/server/products"
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
    <div className="grid gap-6">
      <PageHeader
        title="Testing by Pentest Scout"
        description="No testers on your team, or need an independent test? Ask Pentest Scout. Findings from the engagement appear in your console, marked as raised by Pentest Scout."
        actions={
          owner &&
          productList.length > 0 && (
            <FormSheet
              triggerLabel="Request testing"
              triggerIcon={<FlaskConicalIcon data-icon="inline-start" />}
              title="Request testing"
              description="Pentest Scout replies within one working day. You can cancel any time before testing starts."
              action={createTestingRequestAction.bind(null, org)}
              fields={testingRequestFields(productList)}
              submitLabel="Send request"
              pendingLabel="Sending…"
              success="Request sent to Pentest Scout"
            />
          )
        }
      />
      <ListCard>
        <Table className="min-w-[820px]">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-6">Product</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Dates</TableHead>
              <TableHead className="text-right">Findings</TableHead>
              <TableHead>Requested</TableHead>
              <TableHead className="pr-6 text-right">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {requests.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="max-w-96 py-3 pl-6 whitespace-normal">
                  <div className="flex items-start gap-3">
                    <ProductAvatar id={r.productSlug} name={r.productName} />
                    <span className="grid min-w-0 gap-0.5">
                      <span className="font-medium">{r.productName}</span>
                      <span className="line-clamp-2 text-xs text-muted-foreground">{r.scope}</span>
                      {r.decisionNote && <span className="text-xs">Pentest Scout: {r.decisionNote}</span>}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="py-3">
                  <ToneBadge tone={TESTING_TONE[r.status as TestingStatus]} dot>
                    {TESTING_LABELS[r.status as TestingStatus]}
                  </ToneBadge>
                </TableCell>
                <TableCell className="py-3 text-sm tabular">
                  {r.scheduledStart
                    ? `${day(r.scheduledStart)} – ${day(r.scheduledEnd)}`
                    : r.preferredStart
                      ? `From ${day(r.preferredStart)} (preferred)`
                      : <span className="text-muted-foreground">Flexible</span>}
                </TableCell>
                <TableCell className="py-3 text-right tabular">{r.findings}</TableCell>
                <TableCell className="py-3 tabular">{day(r.createdAt)}</TableCell>
                <TableCell className="py-3 pr-6 text-right">
                  {owner && ["submitted", "accepted", "scheduled"].includes(r.status) && (
                    <RunAction
                      variant="ghost"
                      label="Cancel"
                      pendingLabel="Cancelling…"
                      success="Request cancelled."
                      confirm={{
                        title: `Cancel testing for ${r.productName}?`,
                        description: "Pentest Scout is told straight away. You can send a new request later.",
                        confirmLabel: "Cancel request",
                        destructive: true,
                      }}
                      action={cancelTestingRequestAction.bind(null, org, r.id)}
                    />
                  )}
                </TableCell>
              </TableRow>
            ))}
            {!requests.length && (
              <EmptyRow cols={6} title="No testing requests yet">
                {owner
                  ? productList.length
                    ? "Use Request testing to ask Pentest Scout to test a product."
                    : "Add a product first, then request testing for it."
                  : "An Owner can request testing from Pentest Scout."}
              </EmptyRow>
            )}
          </TableBody>
        </Table>
      </ListCard>
    </div>
  )
}
