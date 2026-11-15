import "server-only"

import { createHmac, randomUUID } from "node:crypto"
import { isIP } from "node:net"
import { headers } from "next/headers"

import { db } from "@/db"
import { auditLogs } from "@/db/schema"

/** A Drizzle transaction or the root client. */
export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0] | typeof db

type AuditEntry = Omit<
  typeof auditLogs.$inferInsert,
  "id" | "occurredAt" | "ip" | "userAgent" | "requestId"
>

/** Never let these reach the log, whatever a caller passes in `changes` or `meta`. */
const SECRET = /password|token|secret|hash/i
const redact = <T extends Record<string, unknown> | null | undefined>(obj: T) =>
  obj &&
  (Object.fromEntries(
    Object.entries(obj).filter(([key]) => !SECRET.test(key))
  ) as T)

/** IP, user agent and request id of the current request. Outside a request (tests, scripts) all are blank. */
export async function requestMeta() {
  let h: Headers
  try {
    h = await headers()
  } catch {
    return { ip: null, userAgent: null, requestId: randomUUID() }
  }
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim()
  const ip = [forwarded, h.get("x-real-ip")].find((v) => v && isIP(v)) ?? null
  return {
    ip,
    userAgent: h.get("user-agent")?.slice(0, 512) ?? null,
    requestId: h.get("x-vercel-id") ?? randomUUID(),
  }
}

/** Keyed hash of an email: lets us count attempts per address without storing it. */
export function emailHash(email: string) {
  const secret = process.env.AUTH_SECRET
  if (!secret || secret.length < 32)
    throw new Error("AUTH_SECRET must be set (32+ chars). See .env.example.")
  return createHmac("sha256", secret).update(email).digest("base64url")
}

/** Append one audit row. Pass the transaction so the row commits or rolls back with the change. */
export async function audit(entry: AuditEntry, tx: Tx = db) {
  await tx.insert(auditLogs).values({
    ...entry,
    changes: redact(entry.changes),
    meta: redact(entry.meta),
    ...(await requestMeta()),
  })
}
