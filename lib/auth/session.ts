import "server-only"

import { createHash, randomBytes } from "node:crypto"
import { and, eq, gt, isNull } from "drizzle-orm"
import { cookies } from "next/headers"
import { cache } from "react"

import { db } from "@/db"
import { sessions, users } from "@/db/schema"

import type { Tx } from "./audit"
import { SESSION_COOKIE, SESSION_MAX_AGE_S } from "./shared"

const IDLE_MS = 12 * 60 * 60 * 1000
const ABSOLUTE_MS = SESSION_MAX_AGE_S * 1000
/** Write last_seen at most this often, not on every request. */
const TOUCH_MS = 5 * 60 * 1000

/** A signed-in person. Company role and product access come from server/context.ts per request. */
export interface Session {
  id: string
  user: { id: string; name: string; email: string; platform: boolean }
}

export const hashToken = (token: string) =>
  createHash("sha256").update(token).digest("base64url")
export const newToken = () => randomBytes(32).toString("base64url")

/** Insert a session row and return the raw token for the cookie (only its hash is stored). */
export async function createSession(
  tx: Tx,
  userId: string,
  meta: { ip: string | null; userAgent: string | null }
) {
  const token = newToken()
  await tx.insert(sessions).values({
    tokenHash: hashToken(token),
    userId,
    expiresAt: new Date(Date.now() + IDLE_MS),
    ip: meta.ip,
    userAgent: meta.userAgent,
  })
  return token
}

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
} as const

export async function setSessionCookie(token: string) {
  ;(await cookies()).set(SESSION_COOKIE, token, {
    ...cookieOptions,
    maxAge: SESSION_MAX_AGE_S,
  })
}

/** Expire with the same attributes it was set with; browsers ignore a bare delete of a __Host- cookie. */
export async function clearSessionCookie() {
  ;(await cookies()).set(SESSION_COOKIE, "", { ...cookieOptions, maxAge: 0 })
}

export async function hasSessionCookie() {
  return (await cookies()).has(SESSION_COOKIE)
}

/** The signed-in user, or null. Checks revocation, idle and absolute expiry, and account status on every call. */
export const getSession = cache(async (): Promise<Session | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  if (!token) return null
  const now = Date.now()

  const [row] = await db
    .select({
      id: sessions.id,
      createdAt: sessions.createdAt,
      lastSeenAt: sessions.lastSeenAt,
      userId: users.id,
      name: users.name,
      email: users.email,
      platformRole: users.platformRole,
      status: users.status,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(
      and(
        eq(sessions.tokenHash, hashToken(token)),
        isNull(sessions.revokedAt),
        gt(sessions.expiresAt, new Date(now))
      )
    )
    .limit(1)

  if (!row || row.status !== "active") return null
  if (now - row.createdAt.getTime() > ABSOLUTE_MS) return null

  if (now - row.lastSeenAt.getTime() > TOUCH_MS)
    await db
      .update(sessions)
      .set({
        lastSeenAt: new Date(now),
        expiresAt: new Date(
          Math.min(now + IDLE_MS, row.createdAt.getTime() + ABSOLUTE_MS)
        ),
      })
      .where(eq(sessions.id, row.id))

  return {
    id: row.id,
    user: {
      id: row.userId,
      name: row.name,
      email: row.email,
      platform: row.platformRole === "SUPER_ADMIN",
    },
  }
})

export async function revokeSession(tx: Tx, id: string) {
  await tx
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(eq(sessions.id, id))
}

/** Sign a user out everywhere (password change, suspension, removal). */
export async function revokeUserSessions(tx: Tx, userId: string) {
  await tx
    .update(sessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)))
}
