"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { SearchIcon } from "lucide-react"

import { CloseoutMeter } from "@/components/closeout-meter"
import { ProductAvatar } from "@/components/product-avatar"
import { HealthBadge, SeverityCounts } from "@/components/status"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { metricsFor } from "@/lib/metrics"
import type { Finding, Product } from "@/lib/types"
import { cn } from "@/lib/utils"

export function ProductTable({
  products,
  findings,
  search,
  onSearch,
  tier,
  onTier,
}: {
  products: Product[]
  findings: Finding[]
  search: string
  onSearch: (value: string) => void
  tier: string
  onTier: (value: string) => void
}) {
  const router = useRouter()

  return (
    <Card className="gap-4">
      <CardHeader className="max-sm:flex max-sm:flex-col">
        <CardTitle>Product security status</CardTitle>
        <CardDescription>
          {products.length} {products.length === 1 ? "product" : "products"} ·
          coverage against the 80% close-out line
        </CardDescription>
        <CardAction className="flex flex-wrap gap-2 max-sm:w-full max-sm:pt-2">
          <InputGroup className="w-full sm:w-56">
            <InputGroupAddon>
              <SearchIcon />
            </InputGroupAddon>
            <InputGroupInput
              aria-label="Search products"
              placeholder="Search products"
              value={search}
              onChange={(event) => onSearch(event.target.value)}
            />
          </InputGroup>
          <Select value={tier} onValueChange={onTier}>
            <SelectTrigger aria-label="Filter by tier" className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All tiers</SelectItem>
              <SelectItem value="1">Tier 1</SelectItem>
              <SelectItem value="2">Tier 2</SelectItem>
              <SelectItem value="3">Tier 3</SelectItem>
            </SelectContent>
          </Select>
        </CardAction>
      </CardHeader>
      <CardContent className="px-0">
        <Table className="min-w-[760px]">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-6">Product</TableHead>
              <TableHead className="w-[24%]">Coverage</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Open findings</TableHead>
              <TableHead className="text-right">Risk score</TableHead>
              <TableHead className="pr-6">Health</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((product) => {
              const m = metricsFor(product, findings)
              const href = `/dashboard/products/${product.id}`
              return (
                <TableRow
                  key={product.id}
                  className="cursor-pointer"
                  onClick={() => router.push(href)}
                >
                  <TableCell className="py-3 pl-6">
                    <Link
                      href={href}
                      onClick={(event) => event.stopPropagation()}
                      className="flex items-center gap-3 rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
                    >
                      <ProductAvatar id={product.id} name={product.name} />
                      <span className="grid gap-0.5">
                        <span className="font-medium">{product.name}</span>
                        <span className="text-xs text-muted-foreground">
                          Tier {product.tier} · {product.status}
                        </span>
                        <HealthBadge
                          health={m.health}
                          className="mt-1 sm:hidden"
                        />
                      </span>
                    </Link>
                  </TableCell>
                  <TableCell>
                    <div className="grid gap-1.5 pr-4">
                      <div className="flex items-baseline justify-between text-xs tabular">
                        <span className="text-sm font-medium text-foreground">
                          {m.coverage}%
                        </span>
                        <span className="text-muted-foreground">
                          {m.tested}/{m.areas} areas
                        </span>
                      </div>
                      <CloseoutMeter counts={m.counts} size="sm" />
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="grid gap-0.5">
                      <span
                        className={cn(
                          "font-medium tabular",
                          m.priorityCoverage === 100 && "text-success"
                        )}
                      >
                        {m.priorityCoverage}%
                      </span>
                      <span className="text-xs text-muted-foreground tabular">
                        {m.priorityTested}/{m.highRisk} high-risk
                      </span>
                    </span>
                  </TableCell>
                  <TableCell>
                    <SeverityCounts count={m.count} className="text-sm" />
                  </TableCell>
                  <TableCell className="text-right font-medium tabular">
                    {m.risk.toFixed(1)}
                  </TableCell>
                  <TableCell className="pr-6">
                    <HealthBadge health={m.health} />
                  </TableCell>
                </TableRow>
              )
            })}
            {!products.length && (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={6}
                  className="py-10 text-center text-muted-foreground"
                >
                  No products match these filters.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
