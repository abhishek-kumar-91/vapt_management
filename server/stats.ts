import "server-only"

import { sql } from "drizzle-orm"

import { withSystem } from "./context"
import type { Tx } from "@/lib/auth/audit"
import { ACTIVE_FINDING_STATUSES } from "@/lib/sop"

const ACTIVE = sql.join(
  ACTIVE_FINDING_STATUSES.map((s) => sql`${s}`),
  sql`, `
)

/**
 * Recount one company's admin totals. Called at the end of every transaction that changes its
 * products, members or findings: a handful of indexed counts on one company, so it stays cheap,
 * and the admin area reads one row per company instead of scanning findings across companies.
 */
export async function refreshOrgStats(tx: Tx, orgId: string, touch = true) {
  await tx.execute(sql`
    insert into org_stats (org_id, products, members, open_critical, open_high, open_total, overdue, last_activity_at, updated_at)
    select
      ${orgId}::uuid,
      (select count(*) from products where org_id = ${orgId} and archived_at is null),
      (select count(*) from memberships where org_id = ${orgId} and status = 'active'),
      count(*) filter (where f.severity = 'Critical'),
      count(*) filter (where f.severity = 'High'),
      count(*),
      count(*) filter (where f.due_on < current_date),
      ${touch ? sql`now()` : sql`(select last_activity_at from org_stats where org_id = ${orgId})`},
      now()
    from findings f
    where f.org_id = ${orgId} and f.status in (${ACTIVE})
    on conflict (org_id) do update set
      products = excluded.products,
      members = excluded.members,
      open_critical = excluded.open_critical,
      open_high = excluded.open_high,
      open_total = excluded.open_total,
      overdue = excluded.overdue,
      last_activity_at = coalesce(excluded.last_activity_at, org_stats.last_activity_at),
      updated_at = now()`)
}

/** Nightly: rebuild every company's totals (overdue counts change as days pass). */
export async function rebuildAllOrgStats() {
  const orgs = await withSystem((tx) =>
    tx.execute<{ id: string }>(sql`select id from organizations`)
  )
  // One short transaction per company, so a large platform never holds one long lock.
  for (const { id } of orgs.rows)
    await withSystem((tx) => refreshOrgStats(tx, id, false))
  return orgs.rows.length
}
