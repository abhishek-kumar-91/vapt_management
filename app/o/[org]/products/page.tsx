import Link from "next/link"
import { notFound } from "next/navigation"

import { createProductAction, setProductArchivedAction } from "@/app/o/[org]/actions"
import { ActionButton } from "@/components/auth/action-button"
import { EmptyRow } from "@/components/admin/bits"
import { ActionForm, type FieldSpec } from "@/components/forms/action-form"
import { PageHeader, SectionHeading } from "@/components/page-header"
import { ProductAvatar } from "@/components/product-avatar"
import { Card } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { roleHas } from "@/lib/auth/roles"
import { DATA_SENSITIVITY } from "@/lib/orgs"
import { getContext } from "@/server/context"
import { listProducts } from "@/server/products"

export const metadata = { title: "Products" }

const FIELDS: FieldSpec[] = [
  { name: "name", label: "Product name", maxLength: 80, placeholder: "Customer web app" },
  {
    name: "tier",
    label: "Tier",
    type: "select",
    half: true,
    options: [
      { value: "1", label: "Tier 1 · business-critical" },
      { value: "2", label: "Tier 2 · important" },
      { value: "3", label: "Tier 3 · standard" },
    ],
  },
  {
    name: "dataSensitivity",
    label: "Data sensitivity",
    type: "select",
    half: true,
    options: [{ value: "", label: "Not sure yet" }, ...DATA_SENSITIVITY.map((v) => ({ value: v, label: v }))],
  },
  { name: "domain", label: "Domain or URL (optional)", placeholder: "app.company.com", half: true },
  { name: "technology", label: "Technology (optional)", placeholder: "Next.js, Postgres", half: true },
]

/** Every product the person can see; Owners add and archive them here. */
export default async function ProductsPage({
  params,
  searchParams,
}: {
  params: Promise<{ org: string }>
  searchParams: Promise<{ archived?: string }>
}) {
  const { org } = await params
  const ctx = await getContext(org)
  if (!ctx) notFound()
  const showArchived = (await searchParams).archived === "1"
  const rows = await listProducts(ctx, { includeArchived: showArchived })
  const owner = roleHas(ctx.role, "product.create")
  const base = `/o/${org}`
  return (
    <div className="grid gap-8">
      <PageHeader
        title="Products"
        description={
          owner
            ? "Everything your company tracks. Add a product and it starts with the standard test areas for its tier."
            : "The products you have access to."
        }
        actions={
          owner && (
            <Link
              href={showArchived ? `${base}/products` : `${base}/products?archived=1`}
              className="text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              {showArchived ? "Hide archived" : "Show archived"}
            </Link>
          )
        }
      />
      <Card className="gap-0 py-0">
        <Table className="min-w-[720px]">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-6">Product</TableHead>
              <TableHead>Tier</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Test areas</TableHead>
              <TableHead className="text-right">Open findings</TableHead>
              {owner && <TableHead className="pr-6 text-right">Manage</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="pl-6">
                  <Link href={`${base}/products/${p.slug}`} className="flex items-center gap-3 hover:underline">
                    <ProductAvatar id={p.slug} name={p.name} className="size-8 text-xs" />
                    <span className="grid leading-tight">
                      <span className="font-medium">{p.name}{p.archivedAt ? " (archived)" : ""}</span>
                      <span className="text-xs text-muted-foreground">{p.domain ?? p.technology ?? ""}</span>
                    </span>
                  </Link>
                </TableCell>
                <TableCell>Tier {p.tier}</TableCell>
                <TableCell>{p.status}</TableCell>
                <TableCell className="text-right tabular">{p.areas}</TableCell>
                <TableCell className="text-right tabular">{p.openFindings}</TableCell>
                {owner && (
                  <TableCell className="pr-6">
                    <ActionButton
                      action={setProductArchivedAction.bind(null, org, p.slug, !p.archivedAt)}
                      label={p.archivedAt ? "Restore" : "Archive"}
                      pendingLabel={p.archivedAt ? "Restoring…" : "Archiving…"}
                      variant="ghost"
                      size="sm"
                    />
                  </TableCell>
                )}
              </TableRow>
            ))}
            {!rows.length && (
              <EmptyRow cols={owner ? 6 : 5}>
                {owner ? "No products yet. Add your first one below." : "You don’t have access to any products yet. Ask an Owner to give you access."}
              </EmptyRow>
            )}
          </TableBody>
        </Table>
      </Card>

      {owner && !showArchived && (
        <section className="grid gap-4">
          <SectionHeading title="Add a product" description="Owners add products. Then give your team access from the Team page." />
          <ActionForm
            action={createProductAction.bind(null, org)}
            fields={FIELDS}
            submitLabel="Add product"
            pendingLabel="Adding…"
            className="max-w-2xl rounded-3xl p-5 ring-1 ring-foreground/10"
          />
        </section>
      )}
    </div>
  )
}
