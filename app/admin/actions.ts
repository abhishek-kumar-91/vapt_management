"use server"

import * as admin from "@/server/admin"
import * as testing from "@/server/testing"

// Thin wrappers; every function in server/admin.ts re-checks the Super Admin role.
export const reviewCompanyAction = async (
  slug: string,
  decision: "approve" | "reject" | "changes",
  note: string
) => admin.reviewCompany(slug, decision, note)

export const setCompanyStatusAction = async (
  slug: string,
  next: "active" | "suspended" | "closed",
  note = ""
) => admin.setCompanyStatus(slug, next, typeof note === "string" ? note : "")

export const resendVerificationAction = async (userId: string) =>
  admin.resendVerificationFor(userId)

export const markOutboxSentAction = async (id: string) => admin.markOutboxSent(id)

export const setUserDisabledAction = async (userId: string, disabled: boolean) =>
  admin.setUserDisabled(userId, disabled)

export const adminResetLinkAction = async (userId: string) =>
  admin.adminResetLink(userId)

export const advanceTestingAction = async (
  id: string,
  step: "accept" | "decline" | "schedule" | "start" | "complete",
  note: string | { start: string; end: string } = ""
) => {
  const result = await testing.advanceRequest(
    id,
    step,
    typeof note === "string" ? { note } : note
  )
  return result.ok ? { ok: true as const } : { ok: false as const, error: result.error ?? "Not done." }
}
