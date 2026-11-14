"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import type { ActionFormState } from "@/components/forms/action-form"
import { getSession } from "@/lib/auth/session"
import { findOnboardingOrg, getContext } from "@/server/context"
import { createCompany, submitForReview, updateCompany } from "@/server/orgs"
import { createProduct, removeSetupProduct } from "@/server/products"

/** The Owner's company that is still being set up or reviewed, as a context. */
async function onboardingCtx() {
  const session = await getSession()
  if (!session) redirect("/login?next=/onboarding")
  const org = await findOnboardingOrg(session.user.id)
  return org ? getContext(org.slug) : null
}

const GONE: ActionFormState = {
  error: "This company is no longer being set up. Reload the page.",
}

export async function createCompanyAction(
  _prev: ActionFormState,
  form: FormData
): Promise<ActionFormState> {
  const session = await getSession()
  if (!session) redirect("/login?next=/onboarding")
  if (await findOnboardingOrg(session.user.id)) redirect("/onboarding")
  const result = await createCompany(session, form)
  if (!result.ok) return result
  redirect("/onboarding")
}

export async function updateCompanyAction(
  _prev: ActionFormState,
  form: FormData
): Promise<ActionFormState> {
  const ctx = await onboardingCtx()
  if (!ctx) return GONE
  const result = await updateCompany(ctx, form)
  if (!result.ok) return result
  revalidatePath("/onboarding")
  return { notice: "Company details saved." }
}

export async function addProductAction(
  _prev: ActionFormState,
  form: FormData
): Promise<ActionFormState> {
  const ctx = await onboardingCtx()
  if (!ctx) return GONE
  const result = await createProduct(ctx, form)
  if (!result.ok) return result
  revalidatePath("/onboarding")
  return { notice: `${String(form.get("name")).trim()} added with its starting test areas.` }
}

export async function removeProductAction(slug: string): Promise<ActionFormState> {
  const ctx = await onboardingCtx()
  if (!ctx) return GONE
  const result = await removeSetupProduct(ctx, slug)
  if (!result.ok) return { error: result.error }
  revalidatePath("/onboarding")
  return { done: true }
}

export async function submitAction(): Promise<ActionFormState> {
  const ctx = await onboardingCtx()
  if (!ctx) return GONE
  const result = await submitForReview(ctx)
  if (!result.ok) return { error: result.error }
  revalidatePath("/onboarding")
  return { done: true }
}
