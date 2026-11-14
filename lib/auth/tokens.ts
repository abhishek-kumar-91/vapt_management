import "server-only"

import { and, eq, gt, inArray, isNull, sql, type SQL } from "drizzle-orm"

import { authTokens, organizations, users } from "@/db/schema"
import { retireTokenEmails } from "@/lib/email/send"
import { withSystem } from "@/server/context"

import type { Tx } from "./audit"
import { hashToken, newToken } from "./session"

export type TokenPurpose = "email_verify" | "org_invite" | "password_reset"

export const TOKEN_TTL_H: Record<TokenPurpose, number> = {
  email_verify: 24,
  org_invite: 72,
  password_reset: 24,
}

/**
 * A valid (unused, unexpired) token with its person and company. Locks the token row inside a
 * transaction. Callers decide whether the person's state lets them use it.
 */
export function lookupToken(
  token: string,
  purpose: TokenPurpose | readonly TokenPurpose[],
  tx?: Tx,
  lock = false
) {
  // Outside a transaction, read in system scope: the token's company name is shown before the
  // person has any access to that company. Callers passing a tx set the scope themselves.
  return tx
    ? queryToken(token, purpose, tx, lock)
    : withSystem((scoped) => queryToken(token, purpose, scoped, lock))
}

async function queryToken(
  token: string,
  purpose: TokenPurpose | readonly TokenPurpose[],
  tx: Tx,
  lock: boolean
) {
  const purposes = typeof purpose === "string" ? [purpose] : purpose
  const query = tx
    .select({
      tokenId: authTokens.id,
      purpose: authTokens.purpose,
      orgId: authTokens.orgId,
      orgName: organizations.name,
      orgSlug: organizations.slug,
      userId: users.id,
      name: users.name,
      email: users.email,
      status: users.status,
      emailVerifiedAt: users.emailVerifiedAt,
      hasPassword: sql<boolean>`${users.passwordHash} is not null`,
    })
    .from(authTokens)
    .innerJoin(users, eq(users.id, authTokens.userId))
    .leftJoin(organizations, eq(organizations.id, authTokens.orgId))
    .where(
      and(
        eq(authTokens.tokenHash, hashToken(token)),
        isNull(authTokens.usedAt),
        gt(authTokens.expiresAt, new Date())
      )
    )
    .limit(1)
  const [row] = lock
    ? await query.for("update", { of: authTokens })
    : await query
  return row && purposes.includes(row.purpose) ? row : null
}

/**
 * For /set-password: an invite for someone who has no password yet, or a reset for an active
 * account. Invites for existing accounts are accepted on /invite instead.
 */
export async function findToken(token: string, tx?: Tx, lock = false) {
  const row = await lookupToken(token, ["org_invite", "password_reset"], tx, lock)
  if (!row) return null
  const usable =
    row.purpose === "org_invite"
      ? row.status === "invited" && !row.hasPassword
      : row.status === "active"
  return usable ? row : null
}

/** Replace this person's outstanding links of the same purpose (and company) with a new one. */
export async function issueToken(
  tx: Tx,
  input: {
    userId: string
    purpose: TokenPurpose
    createdBy?: string | null
    orgId?: string | null
  }
) {
  await deleteTokens(
    tx,
    and(
      eq(authTokens.userId, input.userId),
      eq(authTokens.purpose, input.purpose),
      isNull(authTokens.usedAt)
    )!
  )
  const token = newToken()
  const expiresAt = new Date(
    Date.now() + TOKEN_TTL_H[input.purpose] * 3_600_000
  )
  const [row] = await tx
    .insert(authTokens)
    .values({
      userId: input.userId,
      purpose: input.purpose,
      orgId: input.orgId ?? null,
      tokenHash: hashToken(token),
      createdBy: input.createdBy ?? null,
      expiresAt,
    })
    .returning({ id: authTokens.id })
  return { token, tokenId: row.id, expiresAt }
}

/** Mark a token used and retire the emails that carried it. */
export async function consumeToken(tx: Tx, tokenId: string) {
  await tx
    .update(authTokens)
    .set({ usedAt: new Date() })
    .where(eq(authTokens.id, tokenId))
  await retireTokenEmails(tx, [tokenId])
}

/** Cancel someone's unused links (suspension, removal), optionally only for one company. */
export async function cancelTokens(tx: Tx, userId: string, orgId?: string) {
  await deleteTokens(
    tx,
    and(
      eq(authTokens.userId, userId),
      isNull(authTokens.usedAt),
      orgId ? eq(authTokens.orgId, orgId) : undefined
    )!
  )
}

/** Retire the emails first: deleting a token nulls email_outbox.token_id, losing the link to them. */
async function deleteTokens(tx: Tx, where: SQL) {
  const ids = (
    await tx.select({ id: authTokens.id }).from(authTokens).where(where)
  ).map((r) => r.id)
  if (!ids.length) return
  await retireTokenEmails(tx, ids)
  await tx.delete(authTokens).where(inArray(authTokens.id, ids))
}
