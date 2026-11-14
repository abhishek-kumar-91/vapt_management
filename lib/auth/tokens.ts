import "server-only"

import { and, eq, gt, isNull } from "drizzle-orm"

import { db } from "@/db"
import { authTokens, users } from "@/db/schema"

import type { Tx } from "./audit"
import { hashToken } from "./session"

/** Valid, unused, unexpired token whose user can still use it. Locks the token row inside a transaction. */
export async function findToken(token: string, tx: Tx = db, lock = false) {
  const query = tx
    .select({
      tokenId: authTokens.id,
      purpose: authTokens.purpose,
      userId: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      status: users.status,
    })
    .from(authTokens)
    .innerJoin(users, eq(users.id, authTokens.userId))
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
  if (!row) return null
  const usable =
    row.purpose === "invite"
      ? row.status === "invited"
      : row.status === "active"
  return usable ? row : null
}
