import { sql } from "drizzle-orm"
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgSequence,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core"

import { users } from "./auth"
import {
  areaResult,
  areaStatus,
  eventType,
  findingStatus,
  productStatus,
  reportType,
  severity,
} from "./enums"

const createdAt = () => timestamp({ withTimezone: true }).notNull().defaultNow()
const updatedAt = () =>
  timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date())
const at = () => timestamp({ withTimezone: true })

export const products = pgTable(
  "products",
  {
    id: uuid().primaryKey().defaultRandom(),
    /** URL key: /dashboard/products/<slug> */
    slug: text().notNull().unique(),
    name: text().notNull(),
    tier: smallint().notNull(),
    status: productStatus().notNull().default("Not started"),
    domain: text(),
    ownerId: uuid().references(() => users.id),
    jiraEpic: text(),
    technology: text(),
    dataSensitivity: text(),
    baselineStart: date(),
    estDays: integer(),
    closeoutOn: date(),
    lastTestedOn: date(),
    resumeOn: date(),
    switchReason: text(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check("products_tier_range", sql`${t.tier} between 1 and 3`),
    check(
      "products_est_days_positive",
      sql`${t.estDays} is null or ${t.estDays} >= 0`
    ),
  ]
)

export const testAreas = pgTable(
  "test_areas",
  {
    id: uuid().primaryKey().defaultRandom(),
    productId: uuid()
      .notNull()
      .references(() => products.id),
    name: text().notNull(),
    highRisk: boolean().notNull().default(false),
    status: areaStatus().notNull().default("To Do"),
    position: integer().notNull().default(0),
    jiraKey: text(),
    method: text(),
    result: areaResult(),
    notes: text(),
    blockedReason: text(),
    startedAt: at(),
    testedAt: at(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    unique().on(t.productId, t.name),
    check(
      "test_areas_blocked_has_reason",
      sql`${t.status} <> 'Blocked' or ${t.blockedReason} is not null`
    ),
  ]
)

/** SOP cycles done per product. cycle_key refers to CYCLE_RULES in lib/sop.ts. */
export const cycleCompletions = pgTable(
  "cycle_completions",
  {
    productId: uuid()
      .notNull()
      .references(() => products.id),
    cycleKey: text().notNull(),
    completedOn: date().notNull(),
    completedBy: uuid().references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.productId, t.cycleKey, t.completedOn] })]
)

/** Readable keys (VAPT-0001). Sequence-backed: gaps are possible, collisions are not. */
export const findingKeySeq = pgSequence("finding_key_seq")

export const findings = pgTable(
  "findings",
  {
    id: uuid().primaryKey().defaultRandom(),
    key: text()
      .notNull()
      .unique()
      .default(sql`('VAPT-' || lpad(nextval('finding_key_seq')::text, 4, '0'))`),
    productId: uuid()
      .notNull()
      .references(() => products.id),
    testAreaId: uuid().references(() => testAreas.id),
    title: text().notNull(),
    severity: severity().notNull(),
    status: findingStatus().notNull().default("Open"),
    statusReason: text(),
    cvss: text(),
    description: text(),
    steps: text(),
    impact: text(),
    evidence: text(),
    recommendation: text(),
    reference: text(),
    affectedFeature: text(),
    foundWhile: text(),
    environment: text(),
    relatedTask: text(),
    previousTest: text(),
    discoveryMethod: text(),
    targetRelease: text(),
    late: boolean().notNull().default(false),
    lateCause: text(),
    exploitationSuspected: boolean().notNull().default(false),
    // SOP milestones: calendar days as dates, events as timestamps.
    foundOn: date().notNull(),
    dueOn: date(),
    retestDueOn: date(),
    validatedAt: at(),
    reportedAt: at(),
    readyForRetestAt: at(),
    retestRequestedAt: at(),
    retestCompletedAt: at(),
    closedAt: at(),
    reportedBy: uuid().references(() => users.id),
    assigneeId: uuid().references(() => users.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index().on(t.productId, t.status),
    index().on(t.status, t.dueOn),
    check(
      "findings_exit_has_reason",
      sql`${t.status} not in ('Rejected', 'Risk Accepted', 'Won''t Fix') or ${t.statusReason} is not null`
    ),
  ]
)

/** Team-written product timeline (the Activity page). Not the audit log. */
export const activityEvents = pgTable(
  "activity_events",
  {
    id: uuid().primaryKey().defaultRandom(),
    productId: uuid().references(() => products.id),
    type: eventType().notNull(),
    body: text().notNull(),
    occurredOn: date().notNull(),
    authorId: uuid().references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.occurredOn), index().on(t.productId, t.occurredOn)]
)

export const coverageSnapshots = pgTable(
  "coverage_snapshots",
  {
    productId: uuid()
      .notNull()
      .references(() => products.id),
    takenOn: date().notNull(),
    coveragePct: smallint().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.productId, t.takenOn] }),
    check("coverage_pct_range", sql`${t.coveragePct} between 0 and 100`),
  ]
)

export const reports = pgTable(
  "reports",
  {
    id: uuid().primaryKey().defaultRandom(),
    type: reportType().notNull(),
    periodOn: date().notNull(),
    title: text().notNull(),
    /** Markdown. */
    body: text().notNull(),
    generatedBy: uuid().references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.createdAt)]
)

/** Org-wide settings (retest routing, Jira base). Superadmin only. */
export const appSettings = pgTable("app_settings", {
  key: text().primaryKey(),
  value: jsonb().notNull(),
  updatedBy: uuid().references(() => users.id),
  updatedAt: updatedAt(),
})
