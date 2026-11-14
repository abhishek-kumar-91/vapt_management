import { sql } from "drizzle-orm"
import {
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core"

import {
  membershipStatus,
  orgRole,
  orgStatus,
  productAccess,
} from "./enums"
import { users } from "./identity"
import { products } from "./vapt"

const ts = () => timestamp({ withTimezone: true })

/** Company-level settings kept as one typed document. */
export interface OrgSettings {
  retestEmail?: string
  jiraBaseUrl?: string
}

/** A customer company. Created at onboarding (draft) and used only once approved (active). */
export const organizations = pgTable(
  "organizations",
  {
    id: uuid().primaryKey().defaultRandom(),
    name: text().notNull(),
    /** URL key: /o/<slug>. */
    slug: text().notNull().unique(),
    status: orgStatus().notNull().default("draft"),
    industry: text(),
    size: text(),
    website: text(),
    submittedAt: ts(),
    reviewedAt: ts(),
    reviewedBy: uuid().references(() => users.id),
    /** Why it was rejected or what to change. Shown to the Owner. */
    reviewNote: text(),
    /** Finding keys are <prefix>-<n>, e.g. ACME-42. */
    findingPrefix: text().notNull(),
    /** Next finding number. Taken with UPDATE … RETURNING inside the creating transaction. */
    nextFindingNo: integer().notNull().default(1),
    settings: jsonb().$type<OrgSettings>().notNull().default({}),
    createdBy: uuid().references(() => users.id),
    createdAt: ts().notNull().defaultNow(),
    updatedAt: ts()
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index().on(t.status, t.submittedAt),
    check(
      "organizations_slug_format",
      sql`${t.slug} ~ '^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$'`
    ),
    check(
      "organizations_prefix_format",
      sql`${t.findingPrefix} ~ '^[A-Z][A-Z0-9]{1,9}$'`
    ),
    check(
      "organizations_rejected_has_note",
      sql`${t.status} <> 'rejected' or ${t.reviewNote} is not null`
    ),
  ]
)

/** Who belongs to which company, as what. A company always keeps one active Owner (trigger). */
export const memberships = pgTable(
  "memberships",
  {
    orgId: uuid()
      .notNull()
      .references(() => organizations.id),
    userId: uuid()
      .notNull()
      .references(() => users.id),
    role: orgRole().notNull(),
    status: membershipStatus().notNull().default("invited"),
    invitedBy: uuid().references(() => users.id),
    joinedAt: ts(),
    createdAt: ts().notNull().defaultNow(),
    updatedAt: ts()
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [primaryKey({ columns: [t.orgId, t.userId] }), index().on(t.userId)]
)

/** Which products a member can view or edit. Owners don't need rows: they cover every product. */
export const productMembers = pgTable(
  "product_members",
  {
    orgId: uuid().notNull(),
    productId: uuid().notNull(),
    userId: uuid().notNull(),
    access: productAccess().notNull().default("view"),
    addedBy: uuid().references(() => users.id),
    addedAt: ts().notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.productId, t.userId] }),
    index().on(t.orgId, t.userId),
    foreignKey({
      name: "product_members_product_fk",
      columns: [t.orgId, t.productId],
      foreignColumns: [products.orgId, products.id],
    }).onDelete("cascade"),
    foreignKey({
      name: "product_members_member_fk",
      columns: [t.orgId, t.userId],
      foreignColumns: [memberships.orgId, memberships.userId],
    }).onDelete("cascade"),
  ]
)
