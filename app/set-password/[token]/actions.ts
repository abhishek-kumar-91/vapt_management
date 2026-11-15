"use server"

import { and, eq } from "drizzle-orm"
import { redirect } from "next/navigation"

import { memberships, users } from "@/db/schema"
import { consumeToken, findToken } from "@/lib/auth/tokens"
import { withSystem } from "@/server/context"
import { refreshOrgStats } from "@/server/stats"
import { audit, requestMeta } from "@/lib/auth/audit"
import { hashPassword } from "@/lib/auth/password"
import { passwordProblem } from "@/lib/auth/password-rules"
import {
  createSession,
  revokeUserSessions,
  setSessionCookie,
} from "@/lib/auth/session"

export type SetPasswordState =
  { error?: string; field?: "password" | "confirm" } | undefined

const EXPIRED =
  "This link has expired or was already used. Ask an Owner for a new one."

export async function setPassword(
  token: string,
  _prev: SetPasswordState,
  form: FormData
): Promise<SetPasswordState> {
  const password = String(form.get("password") ?? "")
  const confirm = String(form.get("confirm") ?? "")

  let sessionToken: string | null
  try {
    sessionToken = await withSystem(async (tx) => {
      const row = await findToken(token, tx, true)
      if (!row) return null
      const problem = passwordProblem(password, row.email)
      if (problem) throw new PasswordInputError(problem, "password")
      if (password !== confirm)
        throw new PasswordInputError("Passwords don’t match.", "confirm")

      const invite = row.purpose === "org_invite"
      await tx
        .update(users)
        .set({
          passwordHash: await hashPassword(password),
          passwordChangedAt: new Date(),
          status: "active",
          // Opening a link sent to this address proves they own it.
          ...(invite ? { emailVerifiedAt: new Date() } : {}),
        })
        .where(eq(users.id, row.userId))
      if (invite)
        await tx
          .update(memberships)
          .set({ status: "active", joinedAt: new Date() })
          .where(
            and(
              eq(memberships.orgId, row.orgId!),
              eq(memberships.userId, row.userId),
              eq(memberships.status, "invited")
            )
          )
      if (invite) await refreshOrgStats(tx, row.orgId!)
      await consumeToken(tx, row.tokenId)
      // A new password ends every existing session, wherever it is.
      await revokeUserSessions(tx, row.userId)
      await audit(
        {
          action: invite ? "member.joined" : "user.password_reset",
          outcome: "success",
          actorId: row.userId,
          orgId: row.orgId,
          entityType: "user",
          entityId: row.userId,
          changes: invite ? { status: ["invited", "active"] } : undefined,
        },
        tx
      )
      return createSession(tx, row.userId, await requestMeta())
    })
  } catch (error) {
    if (error instanceof PasswordInputError)
      return { error: error.message, field: error.field }
    console.error("set password failed", error)
    return { error: "That didn’t save. Try again in a minute." }
  }

  if (!sessionToken) return { error: EXPIRED }
  await setSessionCookie(sessionToken)
  redirect("/dashboard")
}

class PasswordInputError extends Error {
  constructor(
    message: string,
    readonly field: "password" | "confirm"
  ) {
    super(message)
  }
}
