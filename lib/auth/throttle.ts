import "server-only"

import { and, eq, gt, or, sql } from "drizzle-orm"

import { db } from "@/db"
import { auditLogs } from "@/db/schema"

/**
 * Recent attempts at `action` from this email (keyed hash) or IP, counted from the audit log,
 * so limits hold across server instances without a separate store.
 */
export async function recentAttempts(
  action: string,
  key: { emailHash?: string; ip?: string | null },
  windowMs: number,
  outcome?: "success" | "failure" | "denied"
) {
  const since = new Date(Date.now() - windowMs)
  const [row] = await db
    .select({
      email: key.emailHash
        ? sql<number>`count(*) filter (where ${auditLogs.emailHash} = ${key.emailHash})::int`
        : sql<number>`0`,
      ip: key.ip
        ? sql<number>`count(*) filter (where ${auditLogs.ip} = ${key.ip})::int`
        : sql<number>`0`,
    })
    .from(auditLogs)
    .where(
      and(
        eq(auditLogs.action, action),
        outcome ? eq(auditLogs.outcome, outcome) : undefined,
        gt(auditLogs.occurredAt, since),
        or(
          key.emailHash ? eq(auditLogs.emailHash, key.emailHash) : undefined,
          key.ip ? eq(auditLogs.ip, key.ip) : undefined
        )
      )
    )
  return row
}
