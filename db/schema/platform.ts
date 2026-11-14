import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core"

import { emailStatus } from "./enums"
import { authTokens, users } from "./identity"
import { organizations } from "./tenancy"

const ts = () => timestamp({ withTimezone: true })

/**
 * Every email the app sends, queued here first (lib/email). `link` and the bodies hold a live
 * token, so they are blanked once sent or expired. Readable by Super Admins only.
 */
export const emailOutbox = pgTable(
  "email_outbox",
  {
    id: uuid().primaryKey().defaultRandom(),
    toEmail: text().notNull(),
    template: text().notNull(),
    subject: text().notNull(),
    bodyText: text(),
    bodyHtml: text(),
    link: text(),
    /** The one-time token inside `link`; when it's used or replaced, the link and bodies are blanked. */
    tokenId: uuid().references(() => authTokens.id, { onDelete: "set null" }),
    orgId: uuid().references(() => organizations.id),
    userId: uuid().references(() => users.id),
    status: emailStatus().notNull().default("pending"),
    attempts: integer().notNull().default(0),
    lastError: text(),
    createdAt: ts().notNull().defaultNow(),
    sentAt: ts(),
    /** When the link inside stops working; the outbox purge blanks it after this. */
    expiresAt: ts(),
  },
  (t) => [
    index().on(t.status, t.createdAt),
    index().on(t.orgId),
    index().on(t.tokenId),
  ]
)

/** One row per company with the counts the admin area lists, so it never scans domain tables. */
export const orgStats = pgTable("org_stats", {
  orgId: uuid()
    .primaryKey()
    .references(() => organizations.id, { onDelete: "cascade" }),
  products: integer().notNull().default(0),
  members: integer().notNull().default(0),
  openCritical: integer().notNull().default(0),
  openHigh: integer().notNull().default(0),
  openTotal: integer().notNull().default(0),
  overdue: integer().notNull().default(0),
  lastActivityAt: ts(),
  updatedAt: ts().notNull().defaultNow(),
})
