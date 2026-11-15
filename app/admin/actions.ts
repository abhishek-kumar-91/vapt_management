"use server"

import * as admin from "@/server/admin"
import * as testing from "@/server/testing"

// Thin wrappers; every function in server/admin.ts re-checks the Super Admin role.
/** `note` is optional: Approve sends none. */
const text = (value: unknown) => (typeof value === "string" ? value : "")

export const reviewCompanyAction = async (
  slug: string,
  decision: "approve" | "reject" | "changes",
  note?: unknown
) => admin.reviewCompany(slug, decision, text(note))

export const setCompanyStatusAction = async (
  slug: string,
  next: "active" | "suspended" | "closed",
  note?: unknown
) => admin.setCompanyStatus(slug, next, text(note))

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
  input?: unknown
) => {
  const range = input && typeof input === "object" ? (input as { start?: unknown; end?: unknown }) : null
  const result = await testing.advanceRequest(
    id,
    step,
    range ? { start: text(range.start), end: text(range.end) } : { note: text(input) }
  )
  return result.ok ? { ok: true as const } : { ok: false as const, error: result.error ?? "Not done." }
}
