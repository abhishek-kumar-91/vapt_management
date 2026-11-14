"use server"

import * as members from "@/server/members"
import { getContext } from "@/server/context"
import * as products from "@/server/products"

// Thin server-action wrappers. The company slug comes from the page URL, and getContext checks
// the caller is an active member (or a Super Admin) before anything runs. server/members.ts
// checks the permission on every call.
type Details = { name: string; email: string; role: string }
type Status = "active" | "suspended" | "removed"

const NO_ACCESS = {
  ok: false,
  error: "Your session ended or you no longer have access. Sign in again.",
} as const

export async function inviteUserAction(org: string, values: Details) {
  const ctx = await getContext(org)
  return ctx ? members.inviteMember(ctx, values) : NO_ACCESS
}
export async function updateUserAction(org: string, id: string, values: Details) {
  const ctx = await getContext(org)
  return ctx ? members.updateMember(ctx, id, values) : NO_ACCESS
}
export async function setUserStatusAction(org: string, id: string, status: Status) {
  const ctx = await getContext(org)
  return ctx ? members.setMemberStatus(ctx, id, status) : NO_ACCESS
}
export async function createAccessLinkAction(org: string, id: string) {
  const ctx = await getContext(org)
  return ctx ? members.createAccessLink(ctx, id) : NO_ACCESS
}

export async function getProductAccessAction(org: string, userId: string) {
  const ctx = await getContext(org)
  return ctx ? products.getProductAccess(ctx, userId) : null
}
export async function setProductAccessAction(
  org: string,
  userId: string,
  access: Record<string, "view" | "edit" | "none">
) {
  const ctx = await getContext(org)
  return ctx ? products.setProductAccess(ctx, userId, access) : NO_ACCESS
}
