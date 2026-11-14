"use client"

import Link from "next/link"
import { DownloadIcon, RefreshCwIcon } from "lucide-react"

import { FindingStatusControl } from "@/components/findings/finding-status-control"
import { SeverityBadge, ToneBadge } from "@/components/status"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { formatDate, todayIso } from "@/lib/dates"
import { retestDueFor } from "@/lib/metrics"
import { retestMailto } from "@/lib/reports"
import { useDashboard } from "@/lib/store"
import type { Finding } from "@/lib/types"
import { cn } from "@/lib/utils"

export function FindingsTable({
  findings,
  showProduct = true,
  emptyText = "No findings in this view.",
}: {
  findings: Finding[]
  showProduct?: boolean
  emptyText?: React.ReactNode
}) {
  const { data, actions } = useDashboard()
  const today = todayIso()
  const columns = showProduct ? 7 : 6

  return (
    <Table className="min-w-[860px]">
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className="pl-6">Finding</TableHead>
          {showProduct && <TableHead>Product</TableHead>}
          <TableHead>Severity</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Found</TableHead>
          <TableHead>Fix deadline</TableHead>
          <TableHead className="pr-6 text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {findings.map((finding) => {
          const productName =
            data.products[finding.product]?.name ?? finding.product
          const overdue =
            !!finding.due &&
            finding.due < today &&
            !["Closed", "Rejected", "Risk Accepted", "Won't Fix"].includes(
              finding.status
            )
          const retestDue = retestDueFor(finding)
          return (
            <TableRow key={finding.id} className="align-top">
              <TableCell className="max-w-[22rem] py-3.5 pl-6 whitespace-normal">
                <div className="grid gap-1">
                  <span className="font-medium text-pretty wrap-anywhere">
                    {finding.title}
                  </span>
                  <span className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="font-mono">{finding.id}</span>
                    {finding.late && (
                      <ToneBadge tone="warning">Late finding</ToneBadge>
                    )}
                  </span>
                </div>
              </TableCell>
              {showProduct && (
                <TableCell className="py-3.5">
                  <Link
                    href={`/dashboard/products/${finding.product}`}
                    className="text-sm underline-offset-4 hover:text-primary hover:underline"
                  >
                    {productName}
                  </Link>
                </TableCell>
              )}
              <TableCell className="py-3.5">
                <SeverityBadge severity={finding.severity} />
              </TableCell>
              <TableCell className="py-2.5">
                <FindingStatusControl
                  finding={finding}
                  onChange={actions.updateFinding}
                />
                {finding.status === "Ready for Retest" && retestDue && (
                  <span
                    className={cn(
                      "mt-1.5 block text-xs",
                      retestDue < today
                        ? "font-medium text-critical"
                        : "text-muted-foreground"
                    )}
                  >
                    Retest by {formatDate(retestDue)}
                  </span>
                )}
              </TableCell>
              <TableCell className="py-3.5 text-muted-foreground tabular">
                {formatDate(finding.found)}
              </TableCell>
              <TableCell
                className={cn(
                  "py-3.5 tabular",
                  overdue
                    ? "font-medium text-critical"
                    : "text-muted-foreground"
                )}
              >
                {finding.due
                  ? formatDate(finding.due)
                  : finding.severity === "Low"
                    ? "Next release"
                    : "—"}
                {overdue && <span className="block text-xs">Overdue</span>}
              </TableCell>
              <TableCell className="py-2.5 pr-6">
                <div className="flex justify-end gap-1.5">
                  {finding.status === "In Fix" && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() =>
                        actions.requestRetest(
                          finding.id,
                          retestMailto(
                            data.config.retestEmail,
                            finding,
                            productName,
                            today
                          )
                        )
                      }
                    >
                      <RefreshCwIcon data-icon="inline-start" />
                      Request retest
                    </Button>
                  )}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label={`Download ${finding.id} report`}
                        onClick={() => actions.downloadFinding(finding)}
                      >
                        <DownloadIcon />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Download SOP report (.md)</TooltipContent>
                  </Tooltip>
                </div>
              </TableCell>
            </TableRow>
          )
        })}
        {!findings.length && (
          <TableRow className="hover:bg-transparent">
            <TableCell
              colSpan={columns}
              className="py-12 text-center text-muted-foreground"
            >
              {emptyText}
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  )
}
