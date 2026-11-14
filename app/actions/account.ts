"use server"

import { and, eq } from "drizzle-orm"
import { redirect } from "next/navigation"

import { db } from "@/db"
import { memberships, users } from "@/db/schema"
import { audit, emailHash, requestMeta } from "@/lib/auth/audit"
import { hashPassword } from "@/lib/auth/password"
import { passwordProblem } from "@/lib/auth/password-rules"
import {
  createSession,
  getSession,
  setSessionCookie,
} from "@/lib/auth/session"
import { EMAIL_PATTERN } from "@/lib/auth/shared"
import { recentAttempts } from "@/lib/auth/throttle"
import { consumeToken, issueToken, lookupToken } from "@/lib/auth/tokens"
import { appUrl, sendEmail, showLinksOnScreen } from "@/lib/email/send"
import { withSystem } from "@/server/context"
import { refreshOrgStats } from "@/server/stats"

/**
 * Public account flows: sign-up, email verification, invite acceptance, password reset requests.
 * Responses never reveal whether an email has an account.
 */

const HOUR = 3_600_000
const UNAVAILABLE = "That didn’t go through. Try again in a minute."
const TOO_MANY = "Too many attempts. Wait an hour, then try again."

export type FormState =
  | {
      error?: string
      fieldErrors?: Record<string, string>
      values?: Record<string, string>
      /** Development only: the link the email carries. */
      devLink?: string
      done?: boolean
    }
  | undefined

const field = (form: FormData, name: string) =>
  String(form.get(name) ?? "").trim()

/** Sign-up. New or existing, the answer is the same "check your email" page. */
export async function signUp(
  _prev: FormState,
  form: FormData
): Promise<FormState> {
  const name = field(form, "name").slice(0, 120)
  const email = field(form, "email").toLowerCase()
  const password = String(form.get("password") ?? "")
  const values = { name, email }

  // Bots fill every field; people never see this one.
  if (field(form, "contact_me")) redirect("/signup/check-email")

  const fieldErrors: Record<string, string> = {}
  if (!name) fieldErrors.name = "Enter your full name."
  if (!EMAIL_PATTERN.test(email) || email.length > 254)
    fieldErrors.email = "Enter a valid work email, like name@company.com."
  const problem = passwordProblem(password, email)
  if (problem) fieldErrors.password = problem
  if (Object.keys(fieldErrors).length) return { fieldErrors, values }

  let devLink: string | undefined
  try {
    const meta = await requestMeta()
    const hash = emailHash(email)
    const recent = await recentAttempts("signup.attempt", { emailHash: hash, ip: meta.ip }, HOUR)
    if (recent.email >= 3 || recent.ip >= 10) return { error: TOO_MANY, values }

    devLink = await db.transaction(async (tx) => {
      const [existing] = await tx
        .select({ id: users.id, name: users.name, status: users.status })
        .from(users)
        .where(eq(users.email, email))
        .for("update")
      await audit(
        {
          action: "signup.attempt",
          outcome: existing ? "denied" : "success",
          actorId: existing?.id ?? null,
          emailHash: hash,
          meta: existing ? { reason: "email_exists" } : undefined,
        },
        tx
      )
      if (existing) {
        await sendEmail(tx, {
          to: email,
          template: "account_exists",
          data: {
            name: existing.name,
            loginUrl: await appUrl("/login"),
            resetUrl: await appUrl("/forgot-password"),
          },
          userId: existing.id,
        })
        return undefined
      }
      const [user] = await tx
        .insert(users)
        .values({
          name,
          email,
          passwordHash: await hashPassword(password),
          passwordChangedAt: new Date(),
          status: "active",
        })
        .returning({ id: users.id })
      const issued = await issueToken(tx, { userId: user.id, purpose: "email_verify" })
      const link = await appUrl(`/verify/${issued.token}`)
      await sendEmail(tx, {
        to: email,
        template: "verify_email",
        data: { name, link },
        userId: user.id,
        link,
        tokenId: issued.tokenId,
        expiresAt: issued.expiresAt,
      })
      await audit(
        { action: "signup.created", outcome: "success", actorId: user.id, entityType: "user", entityId: user.id },
        tx
      )
      return link
    })
  } catch (error) {
    console.error("sign-up failed", error)
    return { error: UNAVAILABLE, values }
  }
  const query = new URLSearchParams({ email })
  if (devLink && showLinksOnScreen()) query.set("dev", devLink)
  redirect(`/signup/check-email?${query}`)
}

/** Confirm the email from the link, then sign the person in and continue onboarding. */
export async function verifyEmail(token: string): Promise<FormState> {
  let sessionToken: string | null
  try {
    sessionToken = await db.transaction(async (tx) => {
      const row = await lookupToken(token, "email_verify", tx, true)
      if (!row || row.status !== "active") return null
      await tx
        .update(users)
        .set({ emailVerifiedAt: new Date() })
        .where(eq(users.id, row.userId))
      await consumeToken(tx, row.tokenId)
      await audit(
        { action: "email.verified", outcome: "success", actorId: row.userId, entityType: "user", entityId: row.userId },
        tx
      )
      return createSession(tx, row.userId, await requestMeta())
    })
  } catch (error) {
    console.error("verify email failed", error)
    return { error: UNAVAILABLE }
  }
  if (!sessionToken)
    return { error: "This link has expired or was already used." }
  await setSessionCookie(sessionToken)
  redirect("/onboarding")
}

/** Send a fresh verification link to the signed-in person. */
export async function resendVerification(): Promise<FormState> {
  const session = await getSession()
  if (!session) redirect("/login")
  try {
    const hash = emailHash(session.user.email)
    const recent = await recentAttempts("email.verify_resent", { emailHash: hash }, HOUR)
    if (recent.email >= 3) return { error: TOO_MANY }
    const link = await db.transaction(async (tx) => {
      const [user] = await tx
        .select({ verified: users.emailVerifiedAt })
        .from(users)
        .where(eq(users.id, session.user.id))
      if (user?.verified) return null
      const issued = await issueToken(tx, { userId: session.user.id, purpose: "email_verify" })
      const link = await appUrl(`/verify/${issued.token}`)
      await sendEmail(tx, {
        to: session.user.email,
        template: "verify_email",
        data: { name: session.user.name, link },
        userId: session.user.id,
        link,
        tokenId: issued.tokenId,
        expiresAt: issued.expiresAt,
      })
      await audit(
        { action: "email.verify_resent", outcome: "success", actorId: session.user.id, emailHash: hash },
        tx
      )
      return link
    })
    return {
      done: true,
      devLink: link && showLinksOnScreen() ? link : undefined,
    }
  } catch (error) {
    console.error("resend verification failed", error)
    return { error: UNAVAILABLE }
  }
}

/** Accept a company invite as the signed-in person it was sent to. */
export async function acceptInvite(token: string): Promise<FormState> {
  const session = await getSession()
  if (!session) redirect(`/login?next=${encodeURIComponent(`/invite/${token}`)}`)
  let slug: string | null
  try {
    slug = await withSystem(async (tx) => {
      const row = await lookupToken(token, "org_invite", tx, true)
      if (!row || row.userId !== session.user.id || !row.orgId) return null
      const joined = await tx
        .update(memberships)
        .set({ status: "active", joinedAt: new Date() })
        .where(
          and(
            eq(memberships.orgId, row.orgId),
            eq(memberships.userId, row.userId),
            eq(memberships.status, "invited")
          )
        )
        .returning({ role: memberships.role })
      if (!joined.length) return null
      await tx
        .update(users)
        .set({ emailVerifiedAt: row.emailVerifiedAt ?? new Date() })
        .where(eq(users.id, row.userId))
      await consumeToken(tx, row.tokenId)
      await refreshOrgStats(tx, row.orgId)
      await audit(
        {
          action: "member.joined",
          outcome: "success",
          actorId: row.userId,
          actorRole: joined[0].role,
          orgId: row.orgId,
          entityType: "user",
          entityId: row.userId,
        },
        tx
      )
      return row.orgSlug
    })
  } catch (error) {
    console.error("accept invite failed", error)
    return { error: UNAVAILABLE }
  }
  if (!slug) return { error: "This invite has expired, was already used, or isn’t for this account." }
  redirect(`/o/${slug}`)
}

/** "Forgot password": same answer whether or not the email has an account. */
export async function requestPasswordReset(
  _prev: FormState,
  form: FormData
): Promise<FormState> {
  const email = field(form, "email").toLowerCase()
  if (!EMAIL_PATTERN.test(email) || email.length > 254)
    return {
      fieldErrors: { email: "Enter a valid work email, like name@company.com." },
      values: { email },
    }
  try {
    const meta = await requestMeta()
    const hash = emailHash(email)
    const recent = await recentAttempts("auth.reset_requested", { emailHash: hash, ip: meta.ip }, HOUR)
    if (recent.email >= 3 || recent.ip >= 20) return { done: true }
    const link = await db.transaction(async (tx) => {
      const [user] = await tx
        .select({ id: users.id, name: users.name, status: users.status })
        .from(users)
        .where(eq(users.email, email))
      await audit(
        {
          action: "auth.reset_requested",
          outcome: user?.status === "active" ? "success" : "denied",
          actorId: user?.id ?? null,
          emailHash: hash,
        },
        tx
      )
      if (user?.status !== "active") return null
      const issued = await issueToken(tx, { userId: user.id, purpose: "password_reset" })
      const link = await appUrl(`/set-password/${issued.token}`)
      await sendEmail(tx, {
        to: email,
        template: "password_reset",
        data: { name: user.name, link },
        userId: user.id,
        link,
        tokenId: issued.tokenId,
        expiresAt: issued.expiresAt,
      })
      return link
    })
    return {
      done: true,
      devLink: link && showLinksOnScreen() ? link : undefined,
    }
  } catch (error) {
    console.error("password reset request failed", error)
    return { error: UNAVAILABLE, values: { email } }
  }
}
