import { sql } from "drizzle-orm"
import {
  check,
  index,
  inet,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core"

import { tokenPurpose, userRole, userStatus } from "./enums"
import { products } from "./vapt"

const ts = () => timestamp({ withTimezone: true })

/** People. Never deleted: deactivate instead, so findings and audit rows keep their author. */
export const users = pgTable(
  "users",
  {
    id: uuid().primaryKey().defaultRandom(),
    email: text().notNull().unique(),
    name: text().notNull(),
    /** argon2id. Null until an invited user sets a password. */
    passwordHash: text(),
    role: userRole().notNull(),
    status: userStatus().notNull().default("invited"),
    passwordChangedAt: ts(),
    lastLoginAt: ts(),
    createdAt: ts().notNull().defaultNow(),
    updatedAt: ts().notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    // Exactly one platform account; customers' top role is OWNER.
    uniqueIndex("users_one_super_admin")
      .on(t.role)
      .where(sql`${t.role} = 'SUPER_ADMIN'`),
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

/** One-time invite and password-reset tokens (hash only, single use, short expiry). */
export const authTokens = pgTable(
  "auth_tokens",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    purpose: tokenPurpose().notNull(),
    tokenHash: text().notNull().unique(),
    createdBy: uuid().references(() => users.id),
    createdAt: ts().notNull().defaultNow(),
    expiresAt: ts().notNull(),
    usedAt: ts(),
  },
  (t) => [index().on(t.userId)]
)

/** Which products a tester or developer is assigned to. */
export const productMembers = pgTable(
  "product_members",
  {
    productId: uuid()
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    addedBy: uuid().references(() => users.id),
    addedAt: ts().notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.productId, t.userId] }),
    index().on(t.userId),
  ]
)
