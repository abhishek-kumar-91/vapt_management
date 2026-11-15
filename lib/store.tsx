"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import {
  createFindingAction,
  recordCycleAction,
  requestRetestAction,
  saveReportAction,
  setAreaFieldAction,
  setAreaStatusAction,
  setFindingStatusAction,
  setProductFieldAction,
} from "@/app/o/[org]/actions"
import { addWorkdays, todayIso } from "./dates"
import { meetsCloseoutCriteria, metricsFor } from "./metrics"
import { buildFindingReport, downloadText } from "./reports"
import {
  CYCLE_RULES,
  EXIT_STATUSES,
  RETEST_WORKDAYS,
  SEVERITIES,
} from "./sop"
import type {
  AreaStatus,
  DashboardData,
  Finding,
  FindingRecord,
  FindingStatus,
  NewFindingValues,
  Product,
  ProductRecord,
  SavedReport,
  TestArea,
} from "./types"

/**
 * The console's data, loaded on the server for this company and this person (server/domain.ts).
 * Changes show instantly, are saved by a server action, and the server's version then replaces
 * the local one, so the database is always the source of truth. A refused change is explained
 * and rolled back.
 */

type Result = { ok: true } | { ok: false; error: string }

const toProducts = (records: Record<string, ProductRecord>): Product[] =>
  Object.entries(records).map(([id, product]) => ({ id, ...product }))

function toFindings(records: Record<string, FindingRecord>): Finding[] {
  return Object.entries(records)
    .map(([id, finding]) => ({ id, ...finding }))
    .sort(
      (a, b) =>
        SEVERITIES.indexOf(a.severity) - SEVERITIES.indexOf(b.severity) ||
        b.found.localeCompare(a.found)
    )
}

const hasText = (value?: string) => !!value?.trim()

/** Typed text is saved after this pause, not on every keystroke. */
const TYPING_MS = 700

function useDashboardState(initial: DashboardData, org: string) {
  const router = useRouter()
  const [data, setData] = React.useState<DashboardData>(initial)
  // A fresh server render (after a save) replaces local state; derive-from-props, no effect.
  const [source, setSource] = React.useState(initial)
  if (source !== initial) {
    setSource(initial)
    setData(initial)
  }

  const products = React.useMemo(() => toProducts(data.products), [data.products])
  const findings = React.useMemo(() => toFindings(data.findings), [data.findings])

  /** Save on the server; on refusal or failure explain why and restore the server's version. */
  const persist = React.useCallback(
    async (save: () => Promise<Result>, success?: string, description?: string) => {
      try {
        const result = await save()
        if (!result.ok) {
          toast.error("Change not saved", { description: result.error })
          router.refresh()
          return false
        }
        if (success) toast.success(success, description ? { description } : undefined)
        return true
      } catch {
        toast.error("Change not saved", {
          description: "Check your connection and try again.",
        })
        router.refresh()
        return false
      }
    },
    [router]
  )

  const timers = React.useRef(new Map<string, ReturnType<typeof setTimeout>>())
  React.useEffect(() => {
    const pending = timers.current
    return () => pending.forEach(clearTimeout)
  }, [])
  /** Debounced save for typed text, one timer per field. */
  const later = (key: string, save: () => Promise<Result>) => {
    clearTimeout(timers.current.get(key))
    timers.current.set(
      key,
      setTimeout(() => {
        timers.current.delete(key)
        void persist(save)
      }, TYPING_MS)
    )
  }

  const areaAt = (productId: string, index: number) =>
    data.products[productId]?.areas?.[index]

  const updateArea = (productId: string, index: number, status: AreaStatus) => {
    const now = todayIso()
    const current = areaAt(productId, index)
    if (!current?.id) return
    const hasReason = hasText(current.reason) || hasText(current.notes)
    if (status === "Tested" && current.s !== "Tested") {
      if (
        !hasText(current.method) ||
        !["No finding", "Finding raised"].includes(current.result ?? "")
      ) {
        toast.warning("Record a method and result first", {
          description:
            "Open this area’s details and fill both before marking it Tested.",
        })
        return
      }
    }
    if (status === "Blocked" && current.s !== "Blocked" && !hasReason) {
      toast.warning("Record a blocker reason first", {
        description:
          "Open this area’s details and add the reason before setting it to Blocked.",
      })
      return
    }
    if (status !== "Blocked" && current.s === "Blocked" && !hasReason) {
      toast.warning(
        "Record why the blocker was cleared before changing the status."
      )
      return
    }
    setData((state) => {
      const product = state.products[productId]
      const areas = product.areas.map((area, i) =>
        i === index
          ? {
              ...area,
              s: status,
              ...(status === "In Testing" && !area.startedAt
                ? { startedAt: now }
                : {}),
              ...(status === "Tested" ? { testedAt: now } : {}),
            }
          : area
      )
      return {
        ...state,
        products: {
          ...state.products,
          [productId]: {
            ...product,
            areas,
            lastTested: status === "Tested" ? now : product.lastTested,
          },
        },
      }
    })
    void persist(
      () => setAreaStatusAction(org, productId, current.id!, status),
      "Test area status saved"
    )
  }

  const AREA_FIELDS = ["method", "result", "notes", "reason", "j", "startedAt", "testedAt"] as const
  type AreaField = (typeof AREA_FIELDS)[number]

  const updateAreaField = (
    productId: string,
    index: number,
    field: keyof TestArea,
    value: string
  ) => {
    const area = areaAt(productId, index)
    if (!area?.id || !(AREA_FIELDS as readonly string[]).includes(field)) return
    setData((state) => {
      const product = state.products[productId]
      const areas = product.areas.map((a, i) =>
        i === index ? { ...a, [field]: value } : a
      )
      return {
        ...state,
        products: {
          ...state.products,
          [productId]: {
            ...product,
            areas,
            ...(field === "testedAt" && value ? { lastTested: value } : {}),
          },
        },
      }
    })
    const save = () =>
      setAreaFieldAction(org, productId, area.id!, field as AreaField, value)
    if (field === "result" || field === "startedAt" || field === "testedAt")
      void persist(save)
    else later(`area:${area.id}:${field}`, save)
  }

  const updateProduct = <K extends keyof ProductRecord>(
    productId: string,
    field: K,
    value: ProductRecord[K]
  ) => {
    const currentProduct = data.products[productId]
    if (!currentProduct) return
    if (
      field === "status" &&
      ["Baseline complete", "Continuous"].includes(value as string)
    ) {
      const product = { id: productId, ...currentProduct }
      if (
        !product.closeout ||
        !meetsCloseoutCriteria(product, metricsFor(product, findings))
      ) {
        toast.warning(`${value} isn’t allowed yet`, {
          description:
            "Requires 100% priority coverage, at least 80% overall, a close-out date, complete finding tickets, and reasons for all untested areas.",
        })
        return
      }
    }
    if (
      field === "status" &&
      value !== currentProduct.status &&
      !(currentProduct.switchReason || "").trim()
    ) {
      toast.warning("Add the Manager-approved reason first", {
        description:
          "Enter the reason / handover in the register before changing the product status.",
      })
      return
    }
    setData((state) => ({
      ...state,
      products: {
        ...state.products,
        [productId]: {
          ...state.products[productId],
          [field]: value,
          ...(field === "status" ? { switchReason: "" } : {}),
        },
      },
    }))
    const save = () =>
      setProductFieldAction(
        org,
        productId,
        field as Parameters<typeof setProductFieldAction>[2],
        value
      )
    if (field === "status")
      void persist(save, "Product status saved and logged")
    else if (field === "tier" || /^(baselineStart|closeout|lastTested|resumeOn)$/.test(field))
      void persist(save)
    else later(`product:${productId}:${field}`, save)
  }

  const updateCycleDate = (productId: string, cycle: string, value: string) => {
    setData((state) => {
      const product = state.products[productId]
      return {
        ...state,
        products: {
          ...state.products,
          [productId]: {
            ...product,
            done: { ...(product.done || {}), [cycle]: value },
            ...(cycle === "baseline" ? { closeout: value } : {}),
            ...(value ? { lastTested: value } : {}),
          },
        },
      }
    })
    const title = CYCLE_RULES.find((row) => row.source === cycle)?.title || cycle
    void persist(
      () => recordCycleAction(org, productId, cycle, value),
      value ? `${title} recorded` : `${title} cleared`,
      "Next due date recalculated."
    )
  }

  const updateFinding = (
    findingId: string,
    status: FindingStatus,
    statusReason = ""
  ) => {
    const existing = data.findings[findingId]
    if (!existing || existing.status === status) return
    if (EXIT_STATUSES.includes(status) && !statusReason.trim()) {
      toast.warning(`${status} needs a recorded reason`, {
        description: "Status was not changed.",
      })
      return
    }
    setData((state) => ({
      ...state,
      findings: {
        ...state.findings,
        [findingId]: { ...existing, status },
      },
    }))
    void persist(
      () => setFindingStatusAction(org, findingId, status, statusReason),
      `${findingId} moved to ${status}`,
      "Activity logged."
    )
  }

  const addFinding = (productId: string, values: NewFindingValues) => {
    const escalate = values.severity === "Critical" || values.severity === "High"
    const pending = toast.loading("Saving finding…")
    void createFindingAction(org, productId, values)
      .then((result) => {
        toast.dismiss(pending)
        if (!result.ok)
          return void toast.error("Finding not saved", { description: result.error })
        toast.success(`${"key" in result ? result.key : "Finding"} created`, {
          description: values.exploitationSuspected
            ? "Production incident escalation logged."
            : escalate
              ? "Same-day escalation recorded."
              : undefined,
        })
      })
      .catch(() => {
        toast.dismiss(pending)
        toast.error("Finding not saved", {
          description: "Check your connection and try again.",
        })
      })
  }

  const requestRetest = (findingId: string, mailto: string) => {
    const existing = data.findings[findingId]
    if (!existing || existing.status !== "In Fix") return
    const due = addWorkdays(todayIso(), RETEST_WORKDAYS)
    setData((state) => ({
      ...state,
      findings: {
        ...state.findings,
        [findingId]: {
          ...existing,
          status: "Ready for Retest",
          readyDate: todayIso(),
          retestDue: due,
        },
      },
    }))
    void persist(() => requestRetestAction(org, findingId)).then((ok) => {
      if (!ok) return
      if (data.config.retestEmail) {
        window.location.href = mailto
        toast.success(`Retest requested for ${findingId}`, {
          description: "Your email app is opening.",
        })
      } else {
        toast.success(`Retest requested for ${findingId}`, {
          description:
            "An Owner can add the tester email in Settings to open an email draft next time.",
        })
      }
    })
  }

  const saveReport = (report: SavedReport & { productId?: string }) => {
    void persist(
      () =>
        saveReportAction(org, {
          type: report.type,
          date: report.date,
          title: report.title,
          body: report.body,
          productSlug: report.productId || undefined,
        }),
      "Report saved to the archive"
    )
  }

  const downloadFinding = (finding: Finding) =>
    downloadText(
      buildFindingReport(finding, data.products[finding.product]),
      `finding-${finding.id}.md`
    )

  /** Server-side export of everything this person can see; recorded in the audit log. */
  const exportData = () => {
    const link = document.createElement("a")
    link.href = `/api/o/${encodeURIComponent(org)}/export`
    link.download = ""
    link.click()
  }

  return {
    data,
    /** Data comes from the server render, so it is always ready. */
    hydrated: true,
    products,
    findings,
    actions: {
      updateArea,
      updateAreaField,
      updateProduct,
      updateCycleDate,
      updateFinding,
      addFinding,
      requestRetest,
      saveReport,
      downloadFinding,
      exportData,
    },
  }
}

type DashboardStore = ReturnType<typeof useDashboardState>

const DashboardContext = React.createContext<DashboardStore | null>(null)

export function DashboardProvider({
  children,
  data,
  org,
}: {
  children: React.ReactNode
  data: DashboardData
  org: string
}) {
  const store = useDashboardState(data, org)
  return (
    <DashboardContext.Provider value={store}>
      {children}
    </DashboardContext.Provider>
  )
}

export function useDashboard() {
  const store = React.useContext(DashboardContext)
  if (!store)
    throw new Error("useDashboard must be used inside <DashboardProvider>.")
  return store
}
