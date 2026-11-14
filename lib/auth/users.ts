import "server-only"

import { and, asc, eq, isNull, ne } from "drizzle-orm"
import { headers } from "next/headers"

import { db } from "@/db"
import { authTokens, users } from "@/db/schema"
import type { TeamUser } from "@/lib/users"

import { audit, type Tx } from "./audit"
import { canManageUser, roleHas, ROLES, type Role } from "./roles"
import {
  getSession,
  hashToken,
  newToken,
  revokeUserSessions,
  type Session,
} from "./session"
import { EMAIL_PATTERN } from "./shared"

/** Users data access. Every function checks the caller's session and permission, and audits. */

export type Result<T = object> =
  ({ ok: true } & T) | { ok: false; error: string }

const SIGNED_OUT = "Your session ended. Sign in again."
const NOT_ALLOWED = "You don’t have permission to do that."
const UNAVAILABLE = "That didn’t save. Check your connection and try again."

const INVITE_TTL_MS = 72 * 60 * 60 * 1000
const RESET_TTL_MS = 24 * 60 * 60 * 1000

async function actor(): Promise<Session["user"] | null> {
  return (await getSession())?.user ?? null
}

const publicUser = {
  id: users.id,
  name: users.name,
  email: users.email,
  role: users.role,
  status: users.status,
  createdAt: users.createdAt,
  lastLoginAt: users.lastLoginAt,
}

/** Everyone the caller may see. The platform SUPER_ADMIN is hidden from customer accounts. */
export async function listUsers(): Promise<Result<{ users: TeamUser[] }>> {
  const me = await actor()
  if (!me) return { ok: false, error: SIGNED_OUT }
  if (!roleHas(me.role, "user.read")) return { ok: false, error: NOT_ALLOWED }
  const rows = await db
    .select(publicUser)
    .from(users)
    .where(
      and(
        ne(users.status, "deactivated"),
        me.role === "SUPER_ADMIN" ? undefined : ne(users.role, "SUPER_ADMIN")
      )
    )
    .orderBy(asc(users.name))
  return {
    ok: true,
    users: rows.map((u) => ({
      ...u,
      status: u.status as TeamUser["status"],
      createdAt: u.createdAt.toISOString(),
      lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
    })),
  }
}

async function linkFor(token: string) {
  const h = await headers()
  const origin =
    h.get("origin") ??
    `${h.get("x-forwarded-proto") ?? "https"}://${h.get("x-forwarded-host") ?? h.get("host")}`
  return `${origin}/set-password/${token}`
}

/** Replace any outstanding links for this user with one new single-use link. */
async function issueLink(
  tx: Tx,
  userId: string,
  purpose: "invite" | "password_reset",
  createdBy: string
) {
  const token = newToken()
  await tx
    .delete(authTokens)
    .where(and(eq(authTokens.userId, userId), isNull(authTokens.usedAt)))
  await tx.insert(authTokens).values({
    userId,
    purpose,
    tokenHash: hashToken(token),
    createdBy,
    expiresAt: new Date(
      Date.now() + (purpose === "invite" ? INVITE_TTL_MS : RESET_TTL_MS)
    ),
  })
  return token
}

function parseDetails(input: {
  name?: unknown
  email?: unknown
  role?: unknown
}) {
  const name = String(input.name ?? "")
    .trim()
    .slice(0, 120)
  const email = String(input.email ?? "")
    .trim()
    .toLowerCase()
  const role = String(input.role ?? "") as Role
  if (!name) return { error: "Enter their full name." }
  if (!EMAIL_PATTERN.test(email) || email.length > 254)
    return { error: "Enter a valid work email, like name@company.com." }
  if (!ROLES.includes(role)) return { error: "Choose a role." }
  return { name, email, role }
}

const isUniqueViolation = (error: unknown) =>
  (error as { code?: string; cause?: { code?: string } })?.code === "23505" ||
  (error as { cause?: { code?: string } })?.cause?.code === "23505"

export async function inviteUser(input: {
  name?: unknown
  email?: unknown
  role?: unknown
}): Promise<Result<{ link: string; expiresInHours: number }>> {
  const me = await actor()
  if (!me) return { ok: false, error: SIGNED_OUT }
  const details = parseDetails(input)
  if ("error" in details) return { ok: false, error: details.error! }
  if (!canManageUser(me, { id: "", role: details.role }, details.role))
    return { ok: false, error: NOT_ALLOWED }

  try {
    const token = await db.transaction(async (tx) => {
      const [existing] = await tx
        .select({ id: users.id, status: users.status })
        .from(users)
        .where(eq(users.email, details.email))
        .for("update")
      if (existing && existing.status !== "deactivated") return null

      // A removed person can be invited again: reuse their row so history stays linked.
      const [user] = existing
        ? await tx
            .update(users)
            .set({
              name: details.name,
              role: details.role,
              status: "invited",
              passwordHash: null,
            })
            .where(eq(users.id, existing.id))
            .returning({ id: users.id })
        : await tx
            .insert(users)
            .values({ ...details, status: "invited" })
            .returning({ id: users.id })

      await audit(
        {
          action: "user.invited",
          outcome: "success",
          actorId: me.id,
          actorRole: me.role,
          entityType: "user",
          entityId: user.id,
          changes: { role: [null, details.role] },
        },
        tx
      )
      return issueLink(tx, user.id, "invite", me.id)
    })
    if (!token)
      return { ok: false, error: "Someone with this email already has access." }
    return { ok: true, link: await linkFor(token), expiresInHours: 72 }
  } catch (error) {
    console.error("invite failed", error)
    return { ok: false, error: UNAVAILABLE }
  }
}

/** Load the target and check the caller may manage it (and move it to nextRole). */
async function target(
  tx: Tx,
  me: Session["user"],
  id: string,
  nextRole?: Role
) {
  const [row] = await tx
    .select(publicUser)
    .from(users)
    .where(eq(users.id, id))
    .for("update")
  if (!row || row.status === "deactivated") return null
  return canManageUser(me, row, nextRole) ? row : null
}

export async function updateUser(
  id: string,
  input: { name?: unknown; email?: unknown; role?: unknown }
): Promise<Result> {
  const me = await actor()
  if (!me) return { ok: false, error: SIGNED_OUT }
  const details = parseDetails(input)
  if ("error" in details) return { ok: false, error: details.error! }

  try {
    return await db.transaction(async (tx): Promise<Result> => {
      const before = await target(tx, me, id, details.role)
      if (!before) return { ok: false, error: NOT_ALLOWED }
      const changes: Record<string, [unknown, unknown]> = Object.fromEntries(
        (["name", "email", "role"] as const)
          .filter((key) => before[key] !== details[key])
          .map((key) => [key, [before[key], details[key]]])
      )
      if (!Object.keys(changes).length) return { ok: true }
      await tx.update(users).set(details).where(eq(users.id, id))
      // A new email is a new sign-in identity: end their sessions.
      if (changes.email) await revokeUserSessions(tx, id)
      await audit(
        {
          action: changes.role ? "user.role_changed" : "user.updated",
          outcome: "success",
          actorId: me.id,
          actorRole: me.role,
          entityType: "user",
          entityId: id,
          changes,
        },
        tx
      )
      return { ok: true }
    })
  } catch (error) {
    if (isUniqueViolation(error))
      return { ok: false, error: "Someone with this email already has access." }
    console.error("update user failed", error)
    return { ok: false, error: UNAVAILABLE }
  }
}

/** Suspend, reactivate, or remove (deactivate). Suspension and removal sign them out everywhere. */
export async function setUserStatus(
  id: string,
  next: "active" | "suspended" | "deactivated"
): Promise<Result> {
  const me = await actor()
  if (!me) return { ok: false, error: SIGNED_OUT }
  try {
    return await db.transaction(async (tx): Promise<Result> => {
      const before = await target(tx, me, id)
      if (!before) return { ok: false, error: NOT_ALLOWED }
      if (next === "active" && before.status !== "suspended")
        return { ok: false, error: "Only suspended users can be reactivated." }
      if (next === "suspended" && before.status !== "active")
        return { ok: false, error: "Only active users can be suspended." }
      await tx.update(users).set({ status: next }).where(eq(users.id, id))
      if (next !== "active") {
        await revokeUserSessions(tx, id)
        await tx
          .delete(authTokens)
          .where(and(eq(authTokens.userId, id), isNull(authTokens.usedAt)))
      }
      await audit(
        {
          action: `user.${next === "active" ? "reactivated" : next === "suspended" ? "suspended" : "removed"}`,
          outcome: "success",
          actorId: me.id,
          actorRole: me.role,
          entityType: "user",
          entityId: id,
          changes: { status: [before.status, next] },
        },
        tx
      )
      return { ok: true }
    })
  } catch (error) {
    console.error("set user status failed", error)
    return { ok: false, error: UNAVAILABLE }
  }
}

/** New invite link for a pending user, or a password reset link for an active one. */
export async function createAccessLink(id: string): Promise<
  Result<{
    link: string
    purpose: "invite" | "password_reset"
    expiresInHours: number
  }>
> {
  const me = await actor()
  if (!me) return { ok: false, error: SIGNED_OUT }
  try {
    const result = await db.transaction(async (tx) => {
      const user = await target(tx, me, id)
      if (!user || user.status === "suspended") return null
      const purpose = user.status === "invited" ? "invite" : "password_reset"
      const token = await issueLink(tx, id, purpose, me.id)
      await audit(
        {
          action:
            purpose === "invite"
              ? "user.invite_link_created"
              : "user.reset_link_created",
          outcome: "success",
          actorId: me.id,
          actorRole: me.role,
          entityType: "user",
          entityId: id,
        },
        tx
      )
      return { token, purpose } as const
    })
    if (!result) return { ok: false, error: NOT_ALLOWED }
    return {
      ok: true,
      purpose: result.purpose,
      link: await linkFor(result.token),
      expiresInHours: result.purpose === "invite" ? 72 : 24,
    }
  } catch (error) {
    console.error("create access link failed", error)
    return { ok: false, error: UNAVAILABLE }
  }
}
