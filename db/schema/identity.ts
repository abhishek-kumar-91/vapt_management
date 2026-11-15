import { sql } from "drizzle-orm"
import {
  check,
  index,
  inet,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core"

import { platformRole, tokenPurpose, userStatus } from "./enums"
import { organizations } from "./tenancy"

const ts = () => timestamp({ withTimezone: true })

/**
 * People, platform-wide. A person is one row whatever companies they belong to; company roles
 * live on memberships. Never deleted, so findings and audit rows keep their author.
 */
export const users = pgTable(
  "users",
  {
    id: uuid().primaryKey().defaultRandom(),
    email: text().notNull().unique(),
    name: text().notNull(),
    /** scrypt (see lib/auth/password.ts). Null only while invited (no password chosen yet). */
    passwordHash: text(),
    /** SUPER_ADMIN or null. Set only by `pnpm user:create` (trigger users_protect_platform_role). */
    platformRole: platformRole(),
    status: userStatus().notNull().default("invited"),
    emailVerifiedAt: ts(),
    passwordChangedAt: ts(),
    lastLoginAt: ts(),
    createdAt: ts().notNull().defaultNow(),
    updatedAt: ts()
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    check("users_email_lowercase", sql`${t.email} = lower(${t.email})`),
    check(
      "users_active_has_password",
      sql`${t.status} <> 'active' or ${t.passwordHash} is not null`
    ),
  ]
)

/** Server-side sessions. The cookie holds a random token; only its SHA-256 is stored. */
export const sessions = pgTable(
  "sessions",
  {
    id: uuid().primaryKey().defaultRandom(),
    tokenHash: text().notNull().unique(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: ts().notNull().defaultNow(),
    lastSeenAt: ts().notNull().defaultNow(),
    expiresAt: ts().notNull(),
    revokedAt: ts(),
    ip: inet(),
    userAgent: text(),
  },
  (t) => [index().on(t.userId)]
)

/** One-time links: email verification, company invites, password resets. Hash only, single use. */
export const authTokens = pgTable(
  "auth_tokens",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    purpose: tokenPurpose().notNull(),
    /** The company an invite is for. Set exactly when purpose = org_invite. */
    orgId: uuid().references(() => organizations.id, { onDelete: "cascade" }),
    tokenHash: text().notNull().unique(),
    createdBy: uuid().references(() => users.id),
    createdAt: ts().notNull().defaultNow(),
    expiresAt: ts().notNull(),
    usedAt: ts(),
  },
  (t) => [
    index().on(t.userId, t.purpose),
    check(
      "auth_tokens_invite_has_org",
      sql`(${t.purpose} = 'org_invite') = (${t.orgId} is not null)`
    ),
  ]
)
