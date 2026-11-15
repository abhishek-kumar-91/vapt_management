import Link from "next/link"

import { EmptyRow, ListCard, ListToolbar } from "@/components/list-card"
import { PageHeader } from "@/components/page-header"
import { ProductAvatar } from "@/components/product-avatar"
import { ToneBadge } from "@/components/status"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { listAllProducts } from "@/server/admin"

export const metadata = { title: "Products" }

export default async function AdminProductsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams
  const rows = await listAllProducts(q)
  return (
    <div className="grid gap-6">
      <PageHeader title="Products" description="Products across every company. Open one to work on it in its company’s console." />
      <ListCard toolbar={<ListToolbar search={{ label: "Search products", placeholder: "Search products, companies or domains" }} />}>
        <Table className="min-w-[760px]">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-6">Product</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Tier</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="pr-6 text-right">Open findings</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={`${r.orgSlug}/${r.slug}`}>
                <TableCell className="py-3 pl-6">
                  <Link href={`/o/${r.orgSlug}/products/${r.slug}`} className="flex items-center gap-3 underline-offset-4 hover:underline">
                    <ProductAvatar id={r.slug} name={r.name} />
                    <span className="grid min-w-0 gap-0.5">
                      <span className="truncate font-medium">{r.name}</span>
                      <span className="truncate text-xs text-muted-foreground">{r.domain ?? "—"}</span>
                    </span>
                  </Link>
                </TableCell>
                <TableCell className="py-3">
                  <Link href={`/admin/companies/${r.orgSlug}`} className="underline-offset-4 hover:underline">
                    {r.orgName}
                  </Link>
                </TableCell>
                <TableCell className="py-3">Tier {r.tier}</TableCell>
                <TableCell className="py-3">{r.archivedAt ? <ToneBadge tone="neutral">Archived</ToneBadge> : r.status}</TableCell>
                <TableCell className="py-3 pr-6 text-right tabular">{r.openFindings}</TableCell>
              </TableRow>
            ))}
            {!rows.length && <EmptyRow cols={5} title="No products match">Try another search.</EmptyRow>}
          </TableBody>
        </Table>
      </ListCard>
    </div>
  )
}
