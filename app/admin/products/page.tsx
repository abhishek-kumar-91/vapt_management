import Link from "next/link"

import { EmptyRow, FilterBar } from "@/components/admin/bits"
import { PageHeader } from "@/components/page-header"
import { Card } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { listAllProducts } from "@/server/admin"

export const metadata = { title: "Products" }

export default async function AdminProductsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams
  const rows = await listAllProducts(q)
  return (
    <div className="grid gap-6">
      <PageHeader title="Products" description="Products across every company. Open one in its company’s console to work on it." />
      <FilterBar q={q} placeholder="Search products, companies or domains" />
      <Card className="gap-0 py-0">
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
                <TableCell className="pl-6">
                  <Link href={`/o/${r.orgSlug}/products/${r.slug}`} className="grid leading-tight hover:underline">
                    <span className="font-medium">{r.name}{r.archivedAt ? " (archived)" : ""}</span>
                    <span className="text-xs text-muted-foreground">{r.domain ?? ""}</span>
                  </Link>
                </TableCell>
                <TableCell>
                  <Link href={`/admin/companies/${r.orgSlug}`} className="hover:underline">{r.orgName}</Link>
                </TableCell>
                <TableCell>Tier {r.tier}</TableCell>
                <TableCell>{r.status}</TableCell>
                <TableCell className="pr-6 text-right tabular">{r.openFindings}</TableCell>
              </TableRow>
            ))}
            {!rows.length && <EmptyRow cols={5}>No products match.</EmptyRow>}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}
