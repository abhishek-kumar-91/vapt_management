"use client"

import * as React from "react"
import { toast } from "sonner"

import sampleData from "@/data.json"
import { addDays, addWorkdays, todayIso } from "./dates"
import {
  coverageSnapshot,
  meetsCloseoutCriteria,
  metricsFor,
  nextFindingId,
} from "./metrics"
import { buildFindingReport, downloadText } from "./reports"
import {
  CYCLE_RULES,
  EXIT_STATUSES,
  PRODUCT_ORDER,
  RETEST_WORKDAYS,
  SEVERITIES,
  SEVERITY_DAYS,
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

const STORAGE_KEY = "vapt-dashboard-data-v1"
const SAMPLE = sampleData as unknown as DashboardData

const BACKUP_KEY = `${STORAGE_KEY}-unreadable`

/** Loads saved records. Unreadable records are copied to BACKUP_KEY instead of being overwritten by sample data. */
function loadSavedData(): { data: DashboardData; recovered: boolean } {
  let saved: string | null = null
  try {
    saved = localStorage.getItem(STORAGE_KEY)
  } catch {
    return { data: SAMPLE, recovered: false }
  }
  try {
    return { data: readSavedData(saved), recovered: false }
  } catch (error) {
    console.error(
      "Unable to load saved dashboard data; using the bundled sample data.",
      error
    )
    try {
      if (saved) localStorage.setItem(BACKUP_KEY, saved)
    } catch {
      /* no room for a backup; the console error above is all we can do */
    }
    return { data: SAMPLE, recovered: true }
  }
}

const isRecord = (value: unknown) =>
  !!value && typeof value === "object" && !Array.isArray(value)

/** Parses saved records; throws when they are unreadable. */
function readSavedData(saved: string | null): DashboardData {
  if (!saved) return SAMPLE
  const parsed = JSON.parse(saved)
  if (
    !isRecord(parsed) ||
    !isRecord(parsed.products) ||
    !isRecord(parsed.findings)
  ) {
    throw new Error(
      "Saved dashboard data is missing required product or finding records."
    )
  }
  return {
    ...SAMPLE,
    ...parsed,
    config: { ...SAMPLE.config, ...parsed.config },
    reports: Array.isArray(parsed.reports) ? parsed.reports : [],
    events: Array.isArray(parsed.events) ? parsed.events : [],
    history: Array.isArray(parsed.history) ? parsed.history : [],
  }
}

/** Returns false when the browser refuses the write (storage full, blocked, or private mode). */
function persistData(data: DashboardData): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    return true
  } catch (error) {
    console.error("Unable to save dashboard data in this browser.", error)
    return false
  }
}

function toProducts(records: Record<string, ProductRecord>): Product[] {
  const known = PRODUCT_ORDER.filter((id) => records[id]).map((id) => ({
    id,
    ...records[id],
  }))
  const rest = Object.entries(records)
    .filter(([id]) => !PRODUCT_ORDER.includes(id))
    .map(([id, product]) => ({ id, ...product }))
  return [...known, ...rest]
}

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

function useDashboardState() {
  const [data, setData] = React.useState<DashboardData>(SAMPLE)
  const [hydrated, setHydrated] = React.useState(false)

  // localStorage only exists in the browser, so load after mount to keep SSR and hydration identical.
  React.useEffect(() => {
    const { data: saved, recovered } = loadSavedData()
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time sync from localStorage after hydration
    setData(saved)
    setHydrated(true)
    if (recovered) {
      toast.error("Saved records couldn’t be read", {
        id: "load-recovered",
        description:
          "Showing sample data instead. The unreadable copy is kept in this browser’s storage, not deleted.",
        duration: Infinity,
      })
    }
  }, [])

  // Another tab saved: take its records so neither tab overwrites the other's work.
  React.useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) return
      try {
        setData(readSavedData(event.newValue))
      } catch {
        /* the other tab wrote something unreadable; keep what this tab has */
      }
    }
    window.addEventListener("storage", onStorage)
    return () => window.removeEventListener("storage", onStorage)
  }, [])

  const saveFailed = React.useRef(false)
  React.useEffect(() => {
    if (!hydrated) return
    const saved = persistData(data)
    if (saved) {
      if (saveFailed.current) toast.dismiss("save-failed")
      saveFailed.current = false
    } else if (!saveFailed.current) {
      saveFailed.current = true
      toast.error("Changes aren’t being saved", {
        id: "save-failed",
        description:
          "This browser’s storage is full or blocked, so your edits will be lost when you close the tab. Export JSON to keep a copy.",
        duration: Infinity,
      })
    }
  }, [data, hydrated])

  const products = React.useMemo(
    () => toProducts(data.products),
    [data.products]
  )
  const findings = React.useMemo(
    () => toFindings(data.findings),
    [data.findings]
  )

  const updateArea = (productId: string, index: number, status: AreaStatus) => {
    const now = todayIso()
    const current = data.products[productId]?.areas?.[index]
    if (!current) return
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
      const oldArea = product.areas[index]
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
      const updated = {
        ...product,
        areas,
        lastTested: status === "Tested" ? now : product.lastTested,
      }
      const area = areas[index]
      const events =
        status !== oldArea.s
          ? [
              {
                date: now,
                type: status === "Blocked" ? "Blocker" : "Progress",
                product: productId,
                text: `${oldArea.n}: ${oldArea.s} → ${status}${status === "Tested" ? ` (${area.result}; method: ${area.method})` : ""}${status === "Blocked" ? `; reason: ${area.reason || area.notes}` : ""}.`,
              },
              ...state.events,
            ]
          : state.events
      const productsState = { ...state.products, [productId]: updated }
      const snapshot = coverageSnapshot(Object.entries(productsState), now)
      const history = [
        ...state.history.filter((item) => item.date !== now),
        snapshot,
      ].sort((a, b) => a.date.localeCompare(b.date))
      return { ...state, products: productsState, events, history }
    })
    toast.success("Test area status saved")
  }

  const updateAreaField = (
    productId: string,
    index: number,
    field: keyof TestArea,
    value: string
  ) => {
    setData((state) => {
      const product = state.products[productId]
      const areas = product.areas.map((area, i) =>
        i === index ? { ...area, [field]: value } : area
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
  }

  const updateProduct = <K extends keyof ProductRecord>(
    productId: string,
    field: K,
    value: ProductRecord[K]
  ) => {
    const currentProduct = data.products[productId]
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
    const changeReason =
      field === "status" ? (currentProduct.switchReason || "").trim() : ""
    if (
      field === "status" &&
      value !== currentProduct.status &&
      !changeReason
    ) {
      toast.warning("Add the Manager-approved reason first", {
        description:
          "Enter the reason / handover in the register before changing the product status.",
      })
      return
    }
    setData((state) => {
      const product = state.products[productId]
      const updated = {
        ...product,
        [field]: value,
        ...(field === "status" ? { switchReason: "" } : {}),
      }
      const coverage = metricsFor(
        { id: productId, ...product },
        toFindings(state.findings)
      ).coverage
      const events =
        field === "status" && value !== product.status
          ? [
              {
                date: todayIso(),
                type: "Switch",
                product: productId,
                text: `Baseline status changed from ${product.status} to ${value}; coverage at change: ${coverage}%. Manager-approved reason / handover: ${changeReason}`,
              },
              ...state.events,
            ]
          : state.events
      return {
        ...state,
        products: { ...state.products, [productId]: updated },
        events,
      }
    })
    if (field === "status") toast.success("Product status saved and logged")
  }

  const updateCycleDate = (productId: string, cycle: string, value: string) => {
    setData((state) => {
      const product = state.products[productId]
      const updated = {
        ...product,
        done: { ...(product.done || {}), [cycle]: value },
        ...(cycle === "baseline" ? { closeout: value } : {}),
        ...(value ? { lastTested: value } : {}),
      }
      const title =
        CYCLE_RULES.find((row) => row.source === cycle)?.title || cycle
      const events = value
        ? [
            {
              date: todayIso(),
              type: "Progress",
              product: productId,
              text: `${title} recorded as completed on ${value}.`,
            },
            ...state.events,
          ]
        : state.events
      return {
        ...state,
        products: { ...state.products, [productId]: updated },
        events,
      }
    })
    toast.success("Cycle date updated", {
      description: "Next due date recalculated.",
    })
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
    const now = todayIso()
    const updated: FindingRecord = {
      ...existing,
      status,
      ...(status === "Ready for Retest"
        ? {
            readyDate: now,
            retestDue: addWorkdays(now, RETEST_WORKDAYS),
            retestRequestedAt: now,
          }
        : {}),
      ...(status === "Closed"
        ? {
            closed: now,
            ...(existing.status === "Ready for Retest"
              ? { retestCompleted: now }
              : {}),
          }
        : {}),
      ...(EXIT_STATUSES.includes(status)
        ? { statusReason: statusReason.trim() }
        : {}),
      ...(["Open", "Triaged", "In Fix"].includes(status)
        ? { closed: "", statusReason: "" }
        : {}),
    }
    setData((state) => ({
      ...state,
      findings: { ...state.findings, [findingId]: updated },
      events: [
        {
          date: now,
          type: status === "Ready for Retest" ? "Retest" : "Finding",
          product: existing.product,
          text: `${findingId} status changed from ${existing.status} to ${status}${statusReason ? `; reason: ${statusReason}` : ""}.`,
        },
        ...state.events,
      ],
    }))
    toast.success(`${findingId} moved to ${status}`, {
      description: "Activity logged.",
    })
  }

  const addFinding = (productId: string, values: NewFindingValues) => {
    const product = data.products[productId]
    const id = nextFindingId(findings, data.config.project || "SEC")
    const found = todayIso()
    const reportedAt = new Date().toISOString()
    const due =
      values.severity === "Low"
        ? values.targetRelease || ""
        : addDays(found, SEVERITY_DAYS[values.severity]!)
    const updatedAreas = (product.areas || []).map((area) =>
      values.late && area.n === values.affectedFeature
        ? {
            ...area,
            s: "In Testing" as const,
            startedAt: found,
            method: [
              area.method,
              `Late-finding follow-up: ${values.discoveryMethod}`,
            ]
              .filter(Boolean)
              .join("\n"),
            notes: `Reopened after ${id}; cause: ${values.lateCause}; previously tested ${values.previousTest}. Check similar features and products.`,
          }
        : area
    )
    const finding: FindingRecord = {
      ...values,
      product: productId,
      title: `[${product.name}][${values.affectedFeature}][${values.severity}] ${values.title.trim()}`,
      status: "Triaged",
      found,
      validatedAt: reportedAt,
      reportedAt,
      due,
      readyDate: "",
      closed: "",
    }
    const escalate =
      values.severity === "Critical" || values.severity === "High"
    setData((state) => {
      const nextProducts = {
        ...state.products,
        [productId]: { ...product, areas: updatedAreas, lastTested: found },
      }
      return {
        ...state,
        findings: { ...state.findings, [id]: finding },
        products: nextProducts,
        events: [
          {
            date: found,
            type: "Finding",
            product: productId,
            text: `${values.severity} finding ${id} validated and reported for ${values.affectedFeature}.${values.late ? " Late finding; check similar areas and products." : ""}`,
          },
          ...(values.late
            ? [
                {
                  date: found,
                  type: "Progress",
                  product: productId,
                  text: `Reopened ${values.affectedFeature} after late finding ${id}; cause ${values.lateCause}; previous test ${values.previousTest}; added method: ${values.discoveryMethod}. Retest similar features and products.`,
                },
              ]
            : []),
          ...(escalate
            ? [
                {
                  date: found,
                  type: "Escalation",
                  product: productId,
                  text: `${values.severity} finding ${id} escalated to the development lead and Manager on the validation date.`,
                },
              ]
            : []),
          ...(values.exploitationSuspected
            ? [
                {
                  date: found,
                  type: "Incident",
                  product: productId,
                  text: `Possible production exploitation suspected for ${id}; notify the Manager and development lead immediately and follow the incident process.`,
                },
              ]
            : []),
          ...state.events,
        ],
        history: [
          ...state.history.filter((item) => item.date !== found),
          coverageSnapshot(Object.entries(nextProducts), found),
        ].sort((a, b) => a.date.localeCompare(b.date)),
      }
    })
    toast.success(`${id} created`, {
      description: values.exploitationSuspected
        ? "Production incident escalation logged."
        : escalate
          ? "Same-day escalation recorded."
          : undefined,
    })
    return id
  }

  const requestRetest = (findingId: string, mailto: string) => {
    const existing = data.findings[findingId]
    if (!existing || existing.status !== "In Fix") return
    const now = todayIso()
    const due = addWorkdays(now, RETEST_WORKDAYS)
    setData((state) => ({
      ...state,
      findings: {
        ...state.findings,
        [findingId]: {
          ...existing,
          status: "Ready for Retest",
          readyDate: now,
          retestDue: due,
          retestRequestedAt: now,
        },
      },
      events: [
        {
          date: now,
          type: "Retest",
          product: existing.product,
          text: `Retest requested for ${findingId}; response target ${due} (2 working days).`,
        },
        ...state.events,
      ],
    }))
    if (data.config.retestEmail) {
      window.location.href = mailto
      toast.success(`Retest requested for ${findingId}`, {
        description: "Your email app is opening.",
      })
    } else {
      toast.success(`Retest requested for ${findingId}`, {
        description:
          "Add the tester email in Settings to open an email draft next time.",
      })
    }
  }

  const saveEmail = (email: string) => {
    setData((state) => ({
      ...state,
      config: { ...state.config, retestEmail: email },
    }))
    toast.success("Retest email saved in this browser")
  }

  const saveReport = (report: SavedReport) => {
    let closeoutId: string | null = null
    if (report.type === "closeout") {
      const match = /## Close-out: ([^\n]+)/.exec(report.body)
      const entry = Object.entries(data.products).find(
        ([, item]) => item.name === match?.[1]
      )
      if (entry) {
        const product = { id: entry[0], ...entry[1] }
        if (meetsCloseoutCriteria(product, metricsFor(product, findings)))
          closeoutId = entry[0]
      }
    }
    setData((state) => ({
      ...state,
      reports: [...(state.reports || []), report],
      ...(closeoutId
        ? {
            products: {
              ...state.products,
              [closeoutId]: {
                ...state.products[closeoutId],
                closeout: report.date,
                done: {
                  ...(state.products[closeoutId].done || {}),
                  baseline: report.date,
                },
              },
            },
          }
        : {}),
      events: [
        {
          date: report.date,
          type: "Report",
          product: "",
          text: `${report.title} saved for ${report.date}.`,
        },
        ...state.events,
      ],
      ...(report.type === "weekly"
        ? {
            history: [
              ...state.history.filter((item) => item.date !== report.date),
              coverageSnapshot(Object.entries(state.products), report.date),
            ].sort((a, b) => a.date.localeCompare(b.date)),
          }
        : {}),
    }))
    toast.success("Report saved to the archive")
  }

  const downloadFinding = (finding: Finding) =>
    downloadText(
      buildFindingReport(finding, data.products[finding.product]),
      `finding-${finding.id}.md`
    )

  const exportData = () =>
    downloadText(
      JSON.stringify(data, null, 2),
      "vapt-dashboard-data.json",
      "application/json"
    )

  const resetData = () => {
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      /* storage unavailable; state reset below still applies */
    }
    setData(SAMPLE)
    toast.success("Local data reset")
  }

  return {
    data,
    hydrated,
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
      saveEmail,
      saveReport,
      downloadFinding,
      exportData,
      resetData,
    },
  }
}

type DashboardStore = ReturnType<typeof useDashboardState>

const DashboardContext = React.createContext<DashboardStore | null>(null)

export function DashboardProvider({ children }: { children: React.ReactNode }) {
  const store = useDashboardState()
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
