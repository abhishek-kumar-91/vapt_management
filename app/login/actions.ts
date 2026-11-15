"use server"

import { and, eq, gt, or, sql } from "drizzle-orm"
import { redirect } from "next/navigation"

import { db } from "@/db"
import { auditLogs, users } from "@/db/schema"
import { audit, emailHash, requestMeta } from "@/lib/auth/audit"
import { decoyHash, verifyPassword } from "@/lib/auth/password"
import { PASSWORD_MAX } from "@/lib/auth/password-rules"
import {
  clearSessionCookie,
  createSession,
  getSession,
  revokeSession,
  setSessionCookie,
} from "@/lib/auth/session"
import { EMAIL_PATTERN, safeNext } from "@/lib/auth/shared"

export type SignInState =
  | {
      error?: string
      fieldErrors?: { email?: string; password?: string }
      email?: string
    }
  | undefined

/** One message for every credential failure, so the response never reveals whether an account exists. */
const WRONG = "Email or password is incorrect."
const THROTTLED = "Too many sign-in attempts. Wait 15 minutes, then try again."
const UNAVAILABLE = "Sign-in is unavailable right now. Try again in a minute."

// Build the decoy hash when the server starts, not on the first unknown-email attempt.
void decoyHash()

const WINDOW_MS = 15 * 60 * 1000
const MAX_PER_EMAIL = 5
const MAX_PER_IP = 30

export async function signIn(
  _prev: SignInState,
  form: FormData
): Promise<SignInState> {
  const email = String(form.get("email") ?? "")
    .trim()
    .toLowerCase()
  const password = String(form.get("password") ?? "")
  const next = safeNext(form.get("next"))

  const fieldErrors: NonNullable<SignInState>["fieldErrors"] = {}
  if (!EMAIL_PATTERN.test(email) || email.length > 254)
    fieldErrors.email = "Enter a valid work email, like name@company.com."
  if (!password) fieldErrors.password = "Enter your password."
  if (fieldErrors.email || fieldErrors.password) return { fieldErrors, email }

  let token: string
  try {
    const meta = await requestMeta()
    const hash = emailHash(email)

    // Throttle on recent failures for this email (known or not) and for this IP.
    const since = new Date(Date.now() - WINDOW_MS)
    const [recent] = await db
      .select({
        email: sql<number>`count(*) filter (where ${auditLogs.emailHash} = ${hash})::int`,
        ip: meta.ip
          ? sql<number>`count(*) filter (where ${auditLogs.ip} = ${meta.ip})::int`
          : sql<number>`0`,
      })
      .from(auditLogs)
      .where(
        and(
          eq(auditLogs.action, "auth.login"),
          eq(auditLogs.outcome, "failure"),
          gt(auditLogs.occurredAt, since),
          or(
            eq(auditLogs.emailHash, hash),
            meta.ip ? eq(auditLogs.ip, meta.ip) : undefined
          )
        )
      )
    if (recent.email >= MAX_PER_EMAIL || recent.ip >= MAX_PER_IP) {
      await audit({
        action: "auth.login",
        outcome: "denied",
        emailHash: hash,
        meta: { reason: "throttled" },
      })
      return { error: THROTTLED, email }
    }

    const [user] = await db
      .select({
        id: users.id,
        platformRole: users.platformRole,
        status: users.status,
        passwordHash: users.passwordHash,
      })
      .from(users)
      .where(eq(users.email, email))
      .limit(1)

    // Always run one full hash check so unknown emails take as long as known ones.
    const valid =
      password.length <= PASSWORD_MAX &&
      (await verifyPassword(
        password,
        user?.passwordHash ?? (await decoyHash())
      ))

    if (!user || !valid || !user.passwordHash || user.status !== "active") {
      await audit({
        action: "auth.login",
        outcome: "failure",
        actorId: user?.id ?? null,
        actorRole: user?.platformRole ?? null,
        actorPlatform: !!user?.platformRole,
        emailHash: hash,
        meta: {
          reason: !user
            ? "unknown_email"
            : !valid || !user.passwordHash
              ? "wrong_password"
              : `account_${user.status}`,
        },
      })
      return { error: WRONG, email }
    }

    token = await db.transaction(async (tx) => {
      const created = await createSession(tx, user.id, meta)
      await tx
        .update(users)
        .set({ lastLoginAt: new Date() })
        .where(eq(users.id, user.id))
      await audit(
        {
          action: "auth.login",
          outcome: "success",
          actorId: user.id,
          actorRole: user.platformRole,
          actorPlatform: !!user.platformRole,
          entityType: "user",
          entityId: user.id,
          emailHash: hash,
        },
        tx
      )
      return created
    })
  } catch (error) {
    console.error("sign-in failed", error)
    return { error: UNAVAILABLE, email }
  }

  await setSessionCookie(token)
  redirect(next)
}

export async function signOut() {
  try {
    const session = await getSession()
    if (session) {
      await db.transaction(async (tx) => {
        await revokeSession(tx, session.id)
        await audit(
          {
            action: "auth.logout",
            outcome: "success",
            actorId: session.user.id,
            actorRole: session.user.platform ? "SUPER_ADMIN" : null,
            actorPlatform: session.user.platform,
          },
          tx
        )
      })
    }
  } catch (error) {
    // Still clear the cookie: the user asked to leave, and the session expires on its own.
    console.error("sign-out could not revoke the session", error)
  }
  await clearSessionCookie()
  redirect("/login?signed_out=1")
}
