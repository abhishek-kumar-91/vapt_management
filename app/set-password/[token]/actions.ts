"use server"

import { eq } from "drizzle-orm"
import { redirect } from "next/navigation"

import { db } from "@/db"
import { authTokens, users } from "@/db/schema"
import { findToken } from "@/lib/auth/tokens"
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
    sessionToken = await db.transaction(async (tx) => {
      const row = await findToken(token, tx, true)
      if (!row) return null
      const problem = passwordProblem(password, row.email)
      if (problem) throw new PasswordInputError(problem, "password")
      if (password !== confirm)
        throw new PasswordInputError("Passwords don’t match.", "confirm")

      await tx
        .update(users)
        .set({
          passwordHash: await hashPassword(password),
          passwordChangedAt: new Date(),
          status: "active",
        })
        .where(eq(users.id, row.userId))
      await tx
        .update(authTokens)
        .set({ usedAt: new Date() })
        .where(eq(authTokens.id, row.tokenId))
      // A new password ends every existing session, wherever it is.
      await revokeUserSessions(tx, row.userId)
      await audit(
        {
          action:
            row.purpose === "invite" ? "user.activated" : "user.password_reset",
          outcome: "success",
          actorId: row.userId,
          actorRole: row.role,
          entityType: "user",
          entityId: row.userId,
          changes:
            row.purpose === "invite"
              ? { status: ["invited", "active"] }
              : undefined,
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
