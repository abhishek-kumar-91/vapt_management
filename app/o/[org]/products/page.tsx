import Link from "next/link"
import { notFound } from "next/navigation"
import { PlusIcon } from "lucide-react"

import { createProductAction, setProductArchivedAction } from "@/app/o/[org]/actions"
import { FormSheet } from "@/components/forms/form-sheet"
import { EmptyRow, ListCard, ListToolbar } from "@/components/list-card"
import { PageHeader } from "@/components/page-header"
import { ProductAvatar } from "@/components/product-avatar"
import { RunAction } from "@/components/run-action"
import { ToneBadge } from "@/components/status"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { roleHas } from "@/lib/auth/roles"
import { PRODUCT_FIELDS } from "@/lib/form-specs"
import { getContext } from "@/server/context"
import { listProducts } from "@/server/products"

export const metadata = { title: "Products" }

/** Every product the person can see; Owners add, archive and restore them here. */
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
  const owner = roleHas(ctx.role, "product.create")
  const showArchived = owner && (await searchParams).archived === "1"
  const all = await listProducts(ctx, { includeArchived: owner })
  const rows = all.filter((p) => !!p.archivedAt === showArchived)
  const archivedCount = all.filter((p) => p.archivedAt).length
  const base = `/o/${org}`

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Products"
        description={
          owner
            ? "Everything your company tracks. A new product starts with the standard test areas for its tier."
            : "The products you have access to."
        }
        actions={
          owner && (
            <FormSheet
              triggerLabel="Add product"
              triggerIcon={<PlusIcon data-icon="inline-start" />}
              title="Add a product"
              description="It starts with the standard test areas for its tier. Give your team access from Team."
              action={createProductAction.bind(null, org)}
              fields={PRODUCT_FIELDS}
              submitLabel="Add product"
              pendingLabel="Adding…"
              success="Product added"
            />
          )
        }
      />
      <ListCard
        toolbar={
          owner ? (
            <ListToolbar
              tabs={{
                param: "archived",
                label: "Which products",
                options: [
                  { value: "", label: "Active", count: all.length - archivedCount },
                  { value: "1", label: "Archived", count: archivedCount },
                ],
              }}
            />
          ) : undefined
        }
      >
        <Table className="min-w-[760px]">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-6">Product</TableHead>
              <TableHead>Tier</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Test areas</TableHead>
              <TableHead className={owner ? "text-right" : "pr-6 text-right"}>Open findings</TableHead>
              {owner && (
                <TableHead className="pr-6 text-right">
                  <span className="sr-only">Actions</span>
                </TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="py-3 pl-6">
                  <Link href={`${base}/products/${p.slug}`} className="flex items-center gap-3 underline-offset-4 hover:underline">
                    <ProductAvatar id={p.slug} name={p.name} />
                    <span className="grid min-w-0 gap-0.5">
                      <span className="truncate font-medium">{p.name}</span>
                      <span className="truncate text-xs text-muted-foreground">
                        {[p.domain, p.technology].filter(Boolean).join(" · ") || "—"}
                      </span>
                    </span>
                  </Link>
                </TableCell>
                <TableCell className="py-3">Tier {p.tier}</TableCell>
                <TableCell className="py-3">
                  {p.archivedAt ? <ToneBadge tone="neutral">Archived</ToneBadge> : p.status}
                </TableCell>
                <TableCell className="py-3 text-right tabular">{p.areas}</TableCell>
                <TableCell className={owner ? "py-3 text-right tabular" : "py-3 pr-6 text-right tabular"}>
                  {p.openFindings}
                </TableCell>
                {owner && (
                  <TableCell className="py-3 pr-6 text-right">
                    {p.archivedAt ? (
                      <RunAction
                        variant="ghost"
                        label="Restore"
                        pendingLabel="Restoring…"
                        success={`${p.name} is back in the sidebar.`}
                        action={setProductArchivedAction.bind(null, org, p.slug, false)}
                      />
                    ) : (
                      <RunAction
                        variant="ghost"
                        label="Archive"
                        pendingLabel="Archiving…"
                        success={`${p.name} archived. Its history is kept.`}
                        confirm={{
                          title: `Archive ${p.name}?`,
                          description: "It leaves the sidebar, the overview and the counts. Its findings, areas and reports are kept, and you can restore it any time.",
                          confirmLabel: "Archive product",
                          destructive: true,
                        }}
                        action={setProductArchivedAction.bind(null, org, p.slug, true)}
                      />
                    )}
                  </TableCell>
                )}
              </TableRow>
            ))}
            {!rows.length && (
              <EmptyRow cols={owner ? 6 : 5} title={showArchived ? "No archived products" : "No products yet"}>
                {showArchived
                  ? "Archived products appear here."
                  : owner
                    ? "Add your first product to start tracking its testing."
                    : "Ask an Owner to give you access to a product."}
              </EmptyRow>
            )}
          </TableBody>
        </Table>
      </ListCard>
    </div>
  )
}
