import { sql } from "drizzle-orm"
import {
  bigint,
  boolean,
  index,
  inet,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core"

import { auditOutcome } from "./enums"
import { users } from "./identity"

/**
 * Append-only security record: who did what, when, from where, and whether it was allowed.
 * Written in the same transaction as the change it records. A trigger (migration
 * 0001_guards.sql) rejects UPDATE, DELETE and TRUNCATE. Super Admins read all of it;
 * an Owner reads their company's rows, including Super Admin actions in it.
 */
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    occurredAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    /** Null for system jobs and sign-in attempts on unknown emails. */
    actorId: uuid().references(() => users.id),
    /** Role at the time (company role, or SUPER_ADMIN), so later changes don't rewrite history. */
    actorRole: text(),
    /** The actor was a Pentest Scout admin. */
    actorPlatform: boolean().notNull().default(false),
    /** dot.case verb, e.g. "finding.status_changed", "auth.login". */
    action: text().notNull(),
    outcome: auditOutcome().notNull(),
    /** Plain ids, no FK: the log outlives anything it describes. Null for platform-level actions. */
    orgId: uuid(),
    entityType: text(),
    entityId: text(),
    productId: uuid(),
    /** Changed fields only, as { field: [before, after] }. Secrets are stripped before insert. */
    changes: jsonb().$type<Record<string, [unknown, unknown]>>(),
    /** Extra context. Never plaintext secrets. */
    meta: jsonb().$type<Record<string, unknown>>(),
    /** HMAC of the email typed at sign-in (known or not). Drives per-email throttling without storing the address. */
    emailHash: text(),
    ip: inet(),
    userAgent: text(),
    requestId: text(),
  },
  (t) => [
    index().on(t.occurredAt.desc()),
    index("audit_logs_org_idx").on(t.orgId, sql`${t.occurredAt} desc`),
    index().on(t.actorId, t.occurredAt),
    index().on(t.entityType, t.entityId),
    index("audit_logs_action_idx").on(t.action, sql`${t.occurredAt} desc`),
    index().on(t.emailHash, t.occurredAt),
    index().on(t.ip, t.occurredAt),
  ]
)
