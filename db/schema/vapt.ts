import { sql } from "drizzle-orm"
import {
  type AnyPgColumn,
  boolean,
  check,
  date,
  foreignKey,
  index,
  integer,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core"

import {
  areaResult,
  areaStatus,
  eventType,
  findingStatus,
  productStatus,
  reportType,
  severity,
  testingRequestStatus,
} from "./enums"
import { users } from "./identity"
import { organizations } from "./tenancy"

/*
 * Every table here belongs to one company (org_id). Children reference parents with a composite
 * key (org_id, parent_id) → parent(org_id, id), so no row can ever point into another company.
 * Row-level security policies on org_id are in migration 0001_guards.sql.
 */

const createdAt = () => timestamp({ withTimezone: true }).notNull().defaultNow()
const updatedAt = () =>
  timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date())
const at = () => timestamp({ withTimezone: true })
const orgId = () =>
  uuid()
    .notNull()
    .references(() => organizations.id)

export const products = pgTable(
  "products",
  {
    id: uuid().primaryKey().defaultRandom(),
    orgId: orgId(),
    /** URL key inside the company: /o/<org>/products/<slug> */
    slug: text().notNull(),
    name: text().notNull(),
    tier: smallint().notNull(),
    status: productStatus().notNull().default("Not started"),
    domain: text(),
    /** Free-text product owner (often someone outside the tool). */
    ownerName: text(),
    jiraEpic: text(),
    technology: text(),
    dataSensitivity: text(),
    baselineStart: date(),
    estDays: integer(),
    closeoutOn: date(),
    lastTestedOn: date(),
    resumeOn: date(),
    switchReason: text(),
    archivedAt: at(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    unique().on(t.orgId, t.slug),
    unique("products_org_id_key").on(t.orgId, t.id),
    check("products_tier_range", sql`${t.tier} between 1 and 3`),
    check(
      "products_est_days_positive",
      sql`${t.estDays} is null or ${t.estDays} >= 0`
    ),
  ]
)

/** (org_id, product_id) → products(org_id, id): the product must be in the same company. */
const productFk = (
  name: string,
  t: { orgId: AnyPgColumn; productId: AnyPgColumn }
) =>
  foreignKey({
    name,
    columns: [t.orgId, t.productId],
    foreignColumns: [products.orgId, products.id],
  })

export const testAreas = pgTable(
  "test_areas",
  {
    id: uuid().primaryKey().defaultRandom(),
    orgId: orgId(),
    productId: uuid().notNull(),
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
    unique("test_areas_org_id_key").on(t.orgId, t.id),
    productFk("test_areas_product_fk", t),
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
    orgId: orgId(),
    productId: uuid().notNull(),
    cycleKey: text().notNull(),
    completedOn: date().notNull(),
    completedBy: uuid().references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.productId, t.cycleKey, t.completedOn] }),
    productFk("cycle_completions_product_fk", t),
  ]
)

export const coverageSnapshots = pgTable(
  "coverage_snapshots",
  {
    orgId: orgId(),
    productId: uuid().notNull(),
    takenOn: date().notNull(),
    coveragePct: smallint().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.productId, t.takenOn] }),
    index().on(t.orgId, t.takenOn),
    productFk("coverage_snapshots_product_fk", t),
    check("coverage_pct_range", sql`${t.coveragePct} between 0 and 100`),
  ]
)

/** A company asking Pentest Scout to test one of its products. Handled by Super Admins. */
export const testingRequests = pgTable(
  "testing_requests",
  {
    id: uuid().primaryKey().defaultRandom(),
    orgId: orgId(),
    productId: uuid().notNull(),
    requestedBy: uuid()
      .notNull()
      .references(() => users.id),
    scope: text().notNull(),
    environment: text(),
    notes: text(),
    contact: text(),
    preferredStart: date(),
    preferredEnd: date(),
    status: testingRequestStatus().notNull().default("submitted"),
    decisionNote: text(),
    assignedTo: uuid().references(() => users.id),
    scheduledStart: date(),
    scheduledEnd: date(),
    completedAt: at(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    unique("testing_requests_org_id_key").on(t.orgId, t.id),
    index().on(t.status, t.createdAt),
    index().on(t.orgId, t.createdAt),
    productFk("testing_requests_product_fk", t),
    check(
      "testing_requests_declined_has_note",
      sql`${t.status} <> 'declined' or ${t.decisionNote} is not null`
    ),
  ]
)

export const findings = pgTable(
  "findings",
  {
    id: uuid().primaryKey().defaultRandom(),
    orgId: orgId(),
    /** Readable key, unique per company: <finding_prefix>-<n>, e.g. ACME-42. */
    key: text().notNull(),
    productId: uuid().notNull(),
    testAreaId: uuid(),
    /** Set when raised by Pentest Scout during a testing request. */
    testingRequestId: uuid(),
    /** Raised by a Pentest Scout admin; the UI labels it "Raised by Pentest Scout". */
    raisedByPlatform: boolean().notNull().default(false),
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
    // SOP milestones: calendar days as dates, events as timestamps. Computed on the server.
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
    unique().on(t.orgId, t.key),
    index().on(t.orgId, t.status, t.dueOn),
    index().on(t.productId, t.status),
    productFk("findings_product_fk", t),
    foreignKey({
      name: "findings_test_area_fk",
      columns: [t.orgId, t.testAreaId],
      foreignColumns: [testAreas.orgId, testAreas.id],
    }),
    foreignKey({
      name: "findings_testing_request_fk",
      columns: [t.orgId, t.testingRequestId],
      foreignColumns: [testingRequests.orgId, testingRequests.id],
    }),
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
    orgId: orgId(),
    productId: uuid(),
    type: eventType().notNull(),
    body: text().notNull(),
    occurredOn: date().notNull(),
    authorId: uuid().references(() => users.id),
    /** Written by a Pentest Scout admin. */
    authorPlatform: boolean().notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [
    index().on(t.orgId, t.occurredOn),
    index().on(t.productId, t.occurredOn),
    productFk("activity_events_product_fk", t),
  ]
)

export const reports = pgTable(
  "reports",
  {
    id: uuid().primaryKey().defaultRandom(),
    orgId: orgId(),
    /** Set for close-out reports. */
    productId: uuid(),
    type: reportType().notNull(),
    periodOn: date().notNull(),
    title: text().notNull(),
    /** Markdown. */
    body: text().notNull(),
    generatedBy: uuid().references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [
    index().on(t.orgId, t.createdAt),
    productFk("reports_product_fk", t),
  ]
)
