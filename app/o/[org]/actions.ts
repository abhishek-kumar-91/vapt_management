"use server"

import { revalidatePath } from "next/cache"

import type { AreaStatus, FindingStatus, NewFindingValues, ReportType } from "@/lib/types"
import { getContext } from "@/server/context"
import * as domain from "@/server/domain"
import type { ProductField } from "@/server/domain"
import { saveOrgSettings } from "@/server/orgs"
import { createProduct, setProductArchived } from "@/server/products"
import * as testing from "@/server/testing"

/**
 * Server actions for the company console. `org` comes from the page URL; getContext checks the
 * caller is an active member (or a Super Admin), and server/domain.ts re-checks the permission
 * and product access for every write.
 */

const NO_ACCESS = { ok: false as const, error: "Your session ended or you no longer have access. Sign in again." }

/**
 * `refresh: false` for text typed into a field: the browser already shows it, and re-rendering
 * from the server mid-typing would overwrite characters typed after the save started.
 */
async function run<T>(
  org: string,
  fn: (ctx: NonNullable<Awaited<ReturnType<typeof getContext>>>) => Promise<T>,
  refresh = true
) {
  const ctx = await getContext(org)
  if (!ctx || (ctx.org.status !== "active" && !ctx.user.platform)) return NO_ACCESS
  const result = await fn(ctx)
  if (refresh) revalidatePath(`/o/${org}`, "layout")
  return result
}

const TYPED_PRODUCT_FIELDS = new Set<ProductField>([
  "switchReason", "technology", "dataSensitivity", "owner", "domain", "jiraEpic", "name", "estDays",
])

export const setAreaStatusAction = async (org: string, product: string, areaId: string, status: AreaStatus) =>
  run(org, (ctx) => domain.setAreaStatus(ctx, product, areaId, status))

export const setAreaFieldAction = async (
  org: string,
  product: string,
  areaId: string,
  field: "method" | "result" | "notes" | "reason" | "j" | "startedAt" | "testedAt",
  value: string
) =>
  run(
    org,
    (ctx) => domain.setAreaField(ctx, product, areaId, field, value),
    field === "result" || field === "startedAt" || field === "testedAt"
  )

export const setProductFieldAction = async (org: string, product: string, field: ProductField, value: unknown) =>
  run(org, (ctx) => domain.setProductField(ctx, product, field, value), !TYPED_PRODUCT_FIELDS.has(field))

export const recordCycleAction = async (org: string, product: string, cycle: string, date: string) =>
  run(org, (ctx) => domain.recordCycle(ctx, product, cycle, date))

export const createFindingAction = async (org: string, product: string, values: NewFindingValues) =>
  run(org, (ctx) => domain.createFinding(ctx, product, values))

export const setFindingStatusAction = async (org: string, key: string, status: FindingStatus, reason = "") =>
  run(org, (ctx) => domain.setFindingStatus(ctx, key, status, reason))

export const requestRetestAction = async (org: string, key: string) =>
  run(org, (ctx) => domain.setFindingStatus(ctx, key, "Ready for Retest", "", { retestRequest: true }))

export const saveReportAction = async (
  org: string,
  report: { type: ReportType; date: string; title: string; body: string; productSlug?: string }
) => run(org, (ctx) => domain.saveReport(ctx, report))

export const saveOrgSettingsAction = async (org: string, _prev: unknown, form: FormData) =>
  run(org, async (ctx) => {
    const result = await saveOrgSettings(ctx, form)
    return result.ok ? { notice: "Settings saved." } : result
  })

export const createProductAction = async (org: string, _prev: unknown, form: FormData) =>
  run(org, async (ctx) => {
    const result = await createProduct(ctx, form)
    return result.ok
      ? { notice: `${String(form.get("name") ?? "").trim()} added with its starting test areas.` }
      : result
  })

export const setProductArchivedAction = async (org: string, product: string, archived: boolean) =>
  run(org, async (ctx) => {
    const result = await setProductArchived(ctx, product, archived)
    return result.ok ? { done: true } : { error: result.error }
  })

export const createTestingRequestAction = async (org: string, _prev: unknown, form: FormData) =>
  run(org, (ctx) => testing.createRequest(ctx, form))

export const cancelTestingRequestAction = async (org: string, id: string) =>
  run(org, async (ctx) => {
    const result = await testing.cancelRequest(ctx, id)
    return result.ok ? { done: true } : { error: result.error }
  })
