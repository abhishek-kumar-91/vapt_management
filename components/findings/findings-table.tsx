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
import { Paginated } from "@/components/ui/table-pagination"
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

const EXIT_STATUSES = ["Closed", "Rejected", "Risk Accepted", "Won't Fix"]

/**
 * The card's width, not the viewport, picks the layout (the sidebar takes a
 * variable share of the screen):
 *  - under 42rem: stacked list, no sideways scroll on phones;
 *  - 42–58rem: table with Product and Found folded into the title line;
 *  - 58rem and up: full table.
 */
export function FindingsTable({
  findings,
  showProduct = true,
  emptyText = "No findings in this view.",
  resetKey,
}: {
  findings: Finding[]
  showProduct?: boolean
  emptyText?: React.ReactNode
  /** Changes to this (the active filters) send paging back to page 1. */
  resetKey?: string
}) {
  const { data, actions } = useDashboard()
  const today = todayIso()

  if (!findings.length)
    return (
      <div className="px-6 py-12 text-center text-muted-foreground">
        {emptyText}
      </div>
    )

  const view = (finding: Finding) => {
    const productName = data.products[finding.product]?.name ?? finding.product
    const overdue =
      !!finding.due &&
      finding.due < today &&
      !EXIT_STATUSES.includes(finding.status)
    const deadline = finding.due
      ? formatDate(finding.due)
      : finding.severity === "Low"
        ? "Next release"
        : "—"
    const retestDue = retestDueFor(finding)
    const productLink = (
      <Link
        href={`/dashboard/products/${finding.product}`}
        className="underline-offset-4 hover:text-primary hover:underline"
      >
        {productName}
      </Link>
    )
    const status = (wide: boolean) => (
      <>
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
        {finding.status === "In Fix" && (
          <Button
            size={wide ? "xs" : "sm"}
            variant="secondary"
            className="mt-1.5 flex"
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
      </>
    )
    const download = (wide: boolean) => (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size={wide ? "icon-sm" : "icon"}
            variant="ghost"
            aria-label={`Download ${finding.id} report`}
            onClick={() => actions.downloadFinding(finding)}
          >
            <DownloadIcon />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Download SOP report (.md)</TooltipContent>
      </Tooltip>
    )
    return { productLink, overdue, deadline, status, download }
  }

  return (
    <Paginated items={findings} resetKey={resetKey} noun="findings">
      {(rows) => (
        <div className="@container">
          <ul className="grid divide-y border-y @min-[42rem]:hidden">
            {rows.map((finding) => {
              const v = view(finding)
              return (
                <li key={finding.id} className="grid gap-3 px-5 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="grid min-w-0 gap-1">
                      <span className="font-medium text-pretty wrap-anywhere">
                        {finding.title}
                      </span>
                      <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground">
                        <span className="font-mono">{finding.id}</span>
                        {showProduct && (
                          <>
                            <span aria-hidden>·</span>
                            {v.productLink}
                          </>
                        )}
                        {finding.late && (
                          <ToneBadge tone="warning">Late finding</ToneBadge>
                        )}
                      </span>
                    </div>
                    <SeverityBadge
                      severity={finding.severity}
                      className="shrink-0"
                    />
                  </div>
                  <dl className="flex flex-wrap gap-x-5 gap-y-1 text-xs tabular">
                    <div className="flex gap-1.5">
                      <dt className="text-muted-foreground">Found</dt>
                      <dd>{formatDate(finding.found)}</dd>
                    </div>
                    <div className="flex gap-1.5">
                      <dt className="text-muted-foreground">Fix by</dt>
                      <dd
                        className={cn(v.overdue && "font-medium text-critical")}
                      >
                        {v.deadline}
                        {v.overdue && " · Overdue"}
                      </dd>
                    </div>
                  </dl>
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">{v.status(false)}</div>
                    {v.download(false)}
                  </div>
                </li>
              )
            })}
          </ul>

          <div className="hidden @min-[42rem]:block">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-6">Finding</TableHead>
                  {showProduct && (
                    <TableHead className="hidden @min-[58rem]:table-cell">
                      Product
                    </TableHead>
                  )}
                  <TableHead>Severity</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden @min-[58rem]:table-cell">
                    Found
                  </TableHead>
                  <TableHead>Fix deadline</TableHead>
                  <TableHead className="pr-6 text-right">Report</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((finding) => {
                  const v = view(finding)
                  return (
                    <TableRow key={finding.id} className="align-top">
                      <TableCell className="w-[40%] min-w-[13rem] py-3.5 pl-6 whitespace-normal @min-[58rem]:min-w-[14rem]">
                        <div className="grid gap-1">
                          <span className="font-medium text-pretty wrap-anywhere">
                            {finding.title}
                          </span>
                          <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground">
                            <span className="font-mono">{finding.id}</span>
                            {showProduct && (
                              <span className="contents @min-[58rem]:hidden">
                                <span aria-hidden>·</span>
                                {v.productLink}
                              </span>
                            )}
                            <span className="basis-full tabular @min-[58rem]:hidden">
                              Found {formatDate(finding.found)}
                            </span>
                            {finding.late && (
                              <ToneBadge tone="warning">Late finding</ToneBadge>
                            )}
                          </span>
                        </div>
                      </TableCell>
                      {showProduct && (
                        <TableCell className="hidden py-3.5 text-sm @min-[58rem]:table-cell">
                          {v.productLink}
                        </TableCell>
                      )}
                      <TableCell className="py-3.5">
                        <SeverityBadge severity={finding.severity} />
                      </TableCell>
                      <TableCell className="py-2.5">{v.status(true)}</TableCell>
                      <TableCell className="hidden py-3.5 text-muted-foreground tabular @min-[58rem]:table-cell">
                        {formatDate(finding.found)}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "py-3.5 tabular",
                          v.overdue
                            ? "font-medium text-critical"
                            : "text-muted-foreground"
                        )}
                      >
                        {v.deadline}
                        {v.overdue && (
                          <span className="block text-xs">Overdue</span>
                        )}
                      </TableCell>
                      <TableCell className="py-2.5 pr-6">
                        <div className="flex justify-end">
                          {v.download(true)}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </Paginated>
  )
}
