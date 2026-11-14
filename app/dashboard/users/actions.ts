"use server"

import * as users from "@/lib/auth/users"

// Thin server-action wrappers; lib/auth/users.ts checks the session and permissions on every call.
type Details = { name: string; email: string; role: string }

export async function inviteUserAction(values: Details) {
  return users.inviteUser(values)
}
export async function updateUserAction(id: string, values: Details) {
  return users.updateUser(id, values)
}
export async function setUserStatusAction(
  id: string,
  status: "active" | "suspended" | "deactivated"
) {
  return users.setUserStatus(id, status)
}
export async function createAccessLinkAction(id: string) {
  return users.createAccessLink(id)
}
