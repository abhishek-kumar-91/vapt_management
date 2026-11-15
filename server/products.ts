import "server-only"

import { and, asc, eq, inArray, isNull, like, or, sql } from "drizzle-orm"

import {
  findings,
  memberships,
  organizations,
  productMembers,
  products,
  testAreas,
} from "@/db/schema"
import type { Tx } from "@/lib/auth/audit"
import { can, canManageUser, roleHas, type Access } from "@/lib/auth/roles"
import { DATA_SENSITIVITY } from "@/lib/orgs"
import { areasForTier, slugify } from "@/lib/sop"

import { auditAs, withOrg, type Ctx } from "./context"
import type { FormResult } from "./orgs"
import { refreshOrgStats } from "./stats"

/** Products of one company: create, list, archive, and who can view or edit each. */

const UNAVAILABLE = "That didn’t save. Check your connection and try again."
const NOT_ALLOWED = "You don’t have permission to do that."

export interface ProductRow {
  id: string
  slug: string
  name: string
  tier: number
  status: string
  domain: string | null
  technology: string | null
  dataSensitivity: string | null
  areas: number
  openFindings: number
  archivedAt: string | null
}

/** Products the caller can see, with area and open-finding counts. */
export async function listProducts(
  ctx: Ctx,
  { includeArchived = false } = {}
): Promise<ProductRow[]> {
  const seesAll = ctx.role === "SUPER_ADMIN" || ctx.role === "OWNER"
  if (!seesAll && !ctx.productIds.length) return []
  const rows = await withOrg(ctx, (tx) =>
    tx
      .select({
        id: products.id,
        slug: products.slug,
        name: products.name,
        tier: products.tier,
        status: products.status,
        domain: products.domain,
        technology: products.technology,
        dataSensitivity: products.dataSensitivity,
        archivedAt: products.archivedAt,
        areas: sql<number>`(select count(*)::int from test_areas a where a.product_id = "products"."id")`,
        openFindings: sql<number>`(select count(*)::int from findings f where f.product_id = "products"."id" and f.status in ('Open','Triaged','In Fix','Ready for Retest'))`,
      })
      .from(products)
      .where(
        and(
          eq(products.orgId, ctx.org.id),
          includeArchived ? undefined : isNull(products.archivedAt),
          seesAll ? undefined : inArray(products.id, ctx.productIds as string[])
        )
      )
      .orderBy(asc(products.name))
  )
  return rows.map((r) => ({ ...r, archivedAt: r.archivedAt?.toISOString() ?? null }))
}

const text = (form: FormData, name: string, max = 200) =>
  String(form.get(name) ?? "")
    .trim()
    .slice(0, max)

/** A slug unique within the company: web, web-2, web-3… */
async function freeSlug(tx: Tx, orgId: string, name: string) {
  const base = slugify(name) || "product"
  const taken = new Set(
    (
      await tx
        .select({ slug: products.slug })
        .from(products)
        .where(
          and(
            eq(products.orgId, orgId),
            or(eq(products.slug, base), like(products.slug, `${base}-%`))
          )
        )
    ).map((r) => r.slug)
  )
  if (!taken.has(base)) return base
  for (let n = 2; ; n++) if (!taken.has(`${base}-${n}`)) return `${base}-${n}`
}

/** Add a product with the tier's starting test areas. Owners only (and Super Admins). */
export async function createProduct(
  ctx: Ctx,
  form: FormData
): Promise<FormResult> {
  if (!roleHas(ctx.role, "product.create")) return { ok: false, error: NOT_ALLOWED }
  const values = {
    name: text(form, "name", 80),
    tier: text(form, "tier"),
    domain: text(form, "domain"),
    technology: text(form, "technology"),
    dataSensitivity: text(form, "dataSensitivity"),
  }
  const fieldErrors: Record<string, string> = {}
  if (values.name.length < 2) fieldErrors.name = "Enter the product’s name."
  const tier = Number(values.tier)
  if (![1, 2, 3].includes(tier)) fieldErrors.tier = "Choose a tier."
  if (
    values.dataSensitivity &&
    !(DATA_SENSITIVITY as readonly string[]).includes(values.dataSensitivity)
  )
    fieldErrors.dataSensitivity = "Choose how sensitive its data is."
  if (Object.keys(fieldErrors).length) return { ok: false, fieldErrors, values }

  try {
    const slug = await withOrg(ctx, async (tx) => {
      const slug = await freeSlug(tx, ctx.org.id, values.name)
      const [product] = await tx
        .insert(products)
        .values({
          orgId: ctx.org.id,
          slug,
          name: values.name,
          tier,
          domain: values.domain || null,
          technology: values.technology || null,
          dataSensitivity: values.dataSensitivity || null,
        })
        .returning({ id: products.id })
      await tx.insert(testAreas).values(
        areasForTier(tier as 1 | 2 | 3).map((a, position) => ({
          orgId: ctx.org.id,
          productId: product.id,
          name: a.name,
          highRisk: a.highRisk,
          position,
        }))
      )
      await refreshOrgStats(tx, ctx.org.id)
      await auditAs(
        ctx,
        {
          action: "product.created",
          outcome: "success",
          entityType: "product",
          entityId: product.id,
          productId: product.id,
          changes: { name: [null, values.name], tier: [null, tier] },
        },
        tx
      )
      return slug
    })
    return { ok: true, slug }
  } catch (error) {
    console.error("create product failed", error)
    return { ok: false, error: UNAVAILABLE, values }
  }
}

async function productBySlug(tx: Tx, ctx: Ctx, slug: string) {
  const [row] = await tx
    .select({ id: products.id, name: products.name, archivedAt: products.archivedAt })
    .from(products)
    .where(and(eq(products.orgId, ctx.org.id), eq(products.slug, slug)))
    .for("update")
  return row ?? null
}

/** Archive or restore. Archived products leave the sidebar and counts; their history stays. */
export async function setProductArchived(
  ctx: Ctx,
  slug: string,
  archived: boolean
): Promise<FormResult> {
  if (!roleHas(ctx.role, "product.archive")) return { ok: false, error: NOT_ALLOWED }
  try {
    return await withOrg(ctx, async (tx): Promise<FormResult> => {
      const product = await productBySlug(tx, ctx, slug)
      if (!product) return { ok: false, error: NOT_ALLOWED }
      await tx
        .update(products)
        .set({ archivedAt: archived ? new Date() : null })
        .where(eq(products.id, product.id))
      await refreshOrgStats(tx, ctx.org.id)
      await auditAs(
        ctx,
        {
          action: archived ? "product.archived" : "product.restored",
          outcome: "success",
          entityType: "product",
          entityId: product.id,
          productId: product.id,
        },
        tx
      )
      return { ok: true }
    })
  } catch (error) {
    console.error("archive product failed", error)
    return { ok: false, error: UNAVAILABLE }
  }
}

/** While the company is still being set up, a product with no findings can be removed outright. */
export async function removeSetupProduct(
  ctx: Ctx,
  slug: string
): Promise<FormResult> {
  if (!roleHas(ctx.role, "product.create")) return { ok: false, error: NOT_ALLOWED }
  try {
    return await withOrg(ctx, async (tx): Promise<FormResult> => {
      const [org] = await tx
        .select({ status: organizations.status })
        .from(organizations)
        .where(eq(organizations.id, ctx.org.id))
      if (org?.status === "active")
        return { ok: false, error: "Archive products instead once the company is live." }
      const product = await productBySlug(tx, ctx, slug)
      if (!product) return { ok: false, error: NOT_ALLOWED }
      const [finding] = await tx
        .select({ id: findings.id })
        .from(findings)
        .where(eq(findings.productId, product.id))
        .limit(1)
      if (finding) return { ok: false, error: "This product has findings; archive it instead." }
      await tx.delete(testAreas).where(eq(testAreas.productId, product.id))
      await tx.delete(products).where(eq(products.id, product.id))
      await refreshOrgStats(tx, ctx.org.id)
      await auditAs(
        ctx,
        { action: "product.removed", outcome: "success", entityType: "product", entityId: product.id },
        tx
      )
      return { ok: true }
    })
  } catch (error) {
    console.error("remove product failed", error)
    return { ok: false, error: UNAVAILABLE }
  }
}

export interface AccessRow {
  productId: string
  slug: string
  name: string
  access: Access | null
  /** The caller may change this product's access (Managers only on products they can edit). */
  editable: boolean
}

/** Product access for one member, as the Team page shows it. */
export async function getProductAccess(
  ctx: Ctx,
  userId: string
): Promise<AccessRow[] | null> {
  if (!roleHas(ctx.role, "member.assign")) return null
  return withOrg(ctx, async (tx) => {
    const [member] = await tx
      .select({ role: memberships.role })
      .from(memberships)
      .where(and(eq(memberships.orgId, ctx.org.id), eq(memberships.userId, userId)))
    if (!member) return null
    const rows = await tx
      .select({
        productId: products.id,
        slug: products.slug,
        name: products.name,
        access: productMembers.access,
      })
      .from(products)
      .leftJoin(
        productMembers,
        and(eq(productMembers.productId, products.id), eq(productMembers.userId, userId))
      )
      .where(and(eq(products.orgId, ctx.org.id), isNull(products.archivedAt)))
      .orderBy(asc(products.name))
    return rows.map((r) => ({
      ...r,
      editable: can(ctx, "member.assign", r.productId),
    }))
  })
}

/**
 * Set a member's access per product: view, edit, or none. Only products the caller may assign
 * are changed; Owners don't need rows (they cover every product).
 */
export async function setProductAccess(
  ctx: Ctx,
  userId: string,
  access: Record<string, Access | "none">
): Promise<FormResult> {
  try {
    return await withOrg(ctx, async (tx): Promise<FormResult> => {
      const [member] = await tx
        .select({ role: memberships.role, status: memberships.status })
        .from(memberships)
        .where(and(eq(memberships.orgId, ctx.org.id), eq(memberships.userId, userId)))
        .for("update")
      if (
        !member ||
        member.status === "removed" ||
        !canManageUser({ id: ctx.user.id, role: ctx.role }, { id: userId, role: member.role })
      )
        return { ok: false, error: NOT_ALLOWED }
      if (member.role === "OWNER")
        return { ok: false, error: "Owners already cover every product." }

      const owned = await tx
        .select({ id: products.id })
        .from(products)
        .where(
          and(
            eq(products.orgId, ctx.org.id),
            inArray(products.id, Object.keys(access).length ? Object.keys(access) : [""])
          )
        )
      const changes: Record<string, [unknown, unknown]> = {}
      for (const { id } of owned) {
        if (!can(ctx, "member.assign", id)) continue
        const next = access[id]
        const [before] = await tx
          .select({ access: productMembers.access })
          .from(productMembers)
          .where(and(eq(productMembers.productId, id), eq(productMembers.userId, userId)))
        const prev = before?.access ?? "none"
        if (prev === next) continue
        if (next === "none")
          await tx
            .delete(productMembers)
            .where(and(eq(productMembers.productId, id), eq(productMembers.userId, userId)))
        else
          await tx
            .insert(productMembers)
            .values({ orgId: ctx.org.id, productId: id, userId, access: next, addedBy: ctx.user.id })
            .onConflictDoUpdate({
              target: [productMembers.productId, productMembers.userId],
              set: { access: next, addedBy: ctx.user.id },
            })
        changes[id] = [prev, next]
      }
      if (Object.keys(changes).length)
        await auditAs(
          ctx,
          {
            action: "product_access.changed",
            outcome: "success",
            entityType: "user",
            entityId: userId,
            changes,
          },
          tx
        )
      return { ok: true }
    })
  } catch (error) {
    console.error("set product access failed", error)
    return { ok: false, error: UNAVAILABLE }
  }
}
