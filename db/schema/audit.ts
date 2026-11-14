import { sql } from "drizzle-orm"
import {
  bigint,
  index,
  inet,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core"

import { users } from "./auth"
import { auditOutcome, userRole } from "./enums"

/**
 * Append-only security record: who did what, when, from where, and whether it was allowed.
 * Written in the same transaction as the change it records. A trigger (migration
 * 0001_guards.sql) rejects UPDATE, DELETE and TRUNCATE. Readable by superadmin only.
 */
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    occurredAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    /** Null for system jobs and sign-in attempts on unknown emails. */
    actorId: uuid().references(() => users.id),
    /** Role at the time, so later role changes don't rewrite history. */
    actorRole: userRole(),
    /** dot.case verb, e.g. "finding.status_changed", "auth.login_failed". */
    action: text().notNull(),
    outcome: auditOutcome().notNull(),
    entityType: text(),
    entityId: text(),
    /** Plain id, no FK: the log outlives anything it describes. */
    productId: uuid(),
    /** Changed fields only, as { field: [before, after] }. Secrets are stripped before insert. */
    changes: jsonb().$type<Record<string, [unknown, unknown]>>(),
    /** Extra context, e.g. sha-256 of an unknown email on a failed sign-in. Never plaintext secrets. */
    meta: jsonb().$type<Record<string, unknown>>(),
    /** HMAC of the email typed at sign-in (known or not). Drives per-email throttling without storing the address. */
    emailHash: text(),
    ip: inet(),
    userAgent: text(),
    requestId: text(),
  },
  (t) => [
    index().on(t.occurredAt.desc()),
    index().on(t.actorId, t.occurredAt),
    index().on(t.entityType, t.entityId),
    index().on(t.productId, t.occurredAt),
    index("audit_logs_action_idx").on(t.action, sql`${t.occurredAt} desc`),
    index().on(t.emailHash, t.occurredAt),
    index().on(t.ip, t.occurredAt),
  ]
)
