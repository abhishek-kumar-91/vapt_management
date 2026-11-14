// Development data: a Super Admin, two active companies and one waiting for review.
//
//   DATABASE_URL=postgresql://localhost/vapt_dev pnpm db:seed
//
// Every account's password is SEED_PASSWORD (default below). Safe to run twice.
// Refuses any non-local database unless ALLOW_DB_RESET=1.
//
//   --domain   also load data.json (products, test areas, findings, activity, coverage history)
//              into Demo Company, so the console has realistic records to work with.
import { readFileSync } from "node:fs"

import { hashPassword } from "../lib/auth/password.ts"

import pg from "pg"

try {
  process.loadEnvFile(".env")
} catch {
  /* DATABASE_URL from the environment */
}
// Seeding writes across companies, so it connects as the table owner.
const url = process.env.MIGRATION_DATABASE_URL ?? process.env.DATABASE_URL
if (!url) {
  console.error("✗ MIGRATION_DATABASE_URL (or DATABASE_URL) is not set.")
  process.exit(1)
}
const { hostname } = new URL(url)
if (!["", "localhost", "127.0.0.1", "[::1]"].includes(hostname) && process.env.ALLOW_DB_RESET !== "1") {
  console.error(`✗ Refusing to seed non-local database "${hostname}".`)
  process.exit(1)
}

const PASSWORD = process.env.SEED_PASSWORD ?? "scout-demo-2026!"

const COMPANIES = [
  {
    slug: "demo",
    name: "Demo Company",
    prefix: "DEMO",
    status: "active",
    members: [
      ["owner@demo.test", "Olivia Owner", "OWNER"],
      ["manager@demo.test", "Marco Manager", "MANAGER"],
      ["tester@demo.test", "Tara Tester", "SECURITY_TESTER"],
      ["dev@demo.test", "Dev Patel", "DEVELOPER"],
    ],
  },
  {
    slug: "acme",
    name: "Acme Corp",
    prefix: "ACME",
    status: "active",
    members: [["owner@acme.test", "Alex Acme", "OWNER"]],
  },
  {
    slug: "northwind",
    name: "Northwind Traders",
    prefix: "NW",
    status: "pending_review",
    members: [["owner@northwind.test", "Nina North", "OWNER"]],
  },
]

const pool = new pg.Pool({ connectionString: url, max: 1 })
const db = await pool.connect()
try {
  const hash = await hashPassword(PASSWORD)
  await db.query("begin")
  await db.query("select set_config('app.cli', 'on', true)")

  const user = async (email, name, platform = null) => {
    const { rows } = await db.query(
      `insert into users (email, name, password_hash, platform_role, status, email_verified_at, password_changed_at)
       values ($1, $2, $3, $4, 'active', now(), now())
       on conflict (email) do update set name = excluded.name
       returning id`,
      [email, name, hash, platform]
    )
    return rows[0].id
  }

  await user("admin@pentestscout.test", "Sam Admin", "SUPER_ADMIN")

  for (const c of COMPANIES) {
    const ownerId = await user(...c.members[0].slice(0, 2))
    const {
      rows: [org],
    } = await db.query(
      `insert into organizations (name, slug, status, finding_prefix, created_by, submitted_at, reviewed_at)
       values ($1, $2, $3::org_status, $4, $5, now(), case when $3::text = 'active' then now() end)
       on conflict (slug) do update set name = excluded.name
       returning id`,
      [c.name, c.slug, c.status, c.prefix, ownerId]
    )
    await db.query(
      `insert into org_stats (org_id) values ($1) on conflict do nothing`,
      [org.id]
    )
    for (const [email, name, role] of c.members) {
      const id = await user(email, name)
      await db.query(
        `insert into memberships (org_id, user_id, role, status, joined_at)
         values ($1, $2, $3, 'active', now())
         on conflict do nothing`,
        [org.id, id, role]
      )
    }
  }
  if (process.argv.includes("--domain")) await loadDomain(db)

  // Company totals for the admin area (same counts as server/stats.ts).
  await db.query(`
    insert into org_stats (org_id, products, members, open_critical, open_high, open_total, overdue, last_activity_at)
    select o.id,
      (select count(*) from products p where p.org_id = o.id and p.archived_at is null),
      (select count(*) from memberships m where m.org_id = o.id and m.status = 'active'),
      (select count(*) from findings f where f.org_id = o.id and f.status in ('Open','Triaged','In Fix','Ready for Retest') and f.severity = 'Critical'),
      (select count(*) from findings f where f.org_id = o.id and f.status in ('Open','Triaged','In Fix','Ready for Retest') and f.severity = 'High'),
      (select count(*) from findings f where f.org_id = o.id and f.status in ('Open','Triaged','In Fix','Ready for Retest')),
      (select count(*) from findings f where f.org_id = o.id and f.status in ('Open','Triaged','In Fix','Ready for Retest') and f.due_on < current_date),
      now()
    from organizations o
    on conflict (org_id) do update set
      products = excluded.products, members = excluded.members, open_critical = excluded.open_critical,
      open_high = excluded.open_high, open_total = excluded.open_total, overdue = excluded.overdue,
      last_activity_at = excluded.last_activity_at, updated_at = now()`)
  await db.query("commit")

  console.log(`✓ Seeded. Every account's password: ${PASSWORD}`)
  console.log("  admin@pentestscout.test  Super Admin")
  for (const c of COMPANIES)
    for (const [email, , role] of c.members)
      console.log(`  ${email.padEnd(24)} ${role} · ${c.name} (${c.status})`)
} catch (error) {
  await db.query("rollback").catch(() => {})
  console.error(`✗ ${error.message}`)
  process.exitCode = 1
} finally {
  db.release()
  await pool.end()
}

/** data.json → Demo Company. Skipped if Demo Company already has products. */
async function loadDomain(db) {
  const data = JSON.parse(readFileSync(new URL("../data.json", import.meta.url), "utf8"))
  const {
    rows: [demo],
  } = await db.query("select id from organizations where slug = 'demo'")
  const {
    rows: [{ n }],
  } = await db.query("select count(*)::int as n from products where org_id = $1", [demo.id])
  if (n) return console.log("  (Demo Company already has products; --domain skipped)")

  const day = (v) => (v && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null)
  const at = (v) => (day(v) ? new Date(v.length > 10 ? v : `${v}T09:00:00Z`) : null)
  const productIds = {}

  for (const [slug, p] of Object.entries(data.products)) {
    const {
      rows: [row],
    } = await db.query(
      `insert into products (org_id, slug, name, tier, status, domain, owner_name, jira_epic, baseline_start,
         est_days, closeout_on, last_tested_on, resume_on, technology, data_sensitivity)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) returning id`,
      [demo.id, slug, p.name, p.tier, p.status, p.domain ?? null, p.owner ?? null, p.jiraEpic ?? null,
       day(p.baselineStart), p.estDays ?? null, day(p.closeout), day(p.lastTested), day(p.resumeOn),
       p.technology ?? null, p.dataSensitivity ?? null]
    )
    productIds[slug] = row.id
    for (const [position, a] of (p.areas ?? []).entries())
      await db.query(
        `insert into test_areas (org_id, product_id, name, high_risk, status, position, jira_key, method, result,
           notes, blocked_reason, started_at, tested_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
        [demo.id, row.id, a.n, !!a.hr, a.s, position, a.j ?? null, a.method || null, a.result || null,
         a.notes || null, a.reason || (a.s === "Blocked" ? a.notes || "Blocked (imported)" : null),
         at(a.startedAt), at(a.testedAt)]
      )
    for (const [cycle, on] of Object.entries(p.done ?? {}))
      if (day(on))
        await db.query(
          `insert into cycle_completions (org_id, product_id, cycle_key, completed_on) values ($1,$2,$3,$4)
           on conflict do nothing`,
          [demo.id, row.id, cycle, day(on)]
        )
  }

  const exits = ["Rejected", "Risk Accepted", "Won't Fix"]
  let highest = 0
  for (const [key, f] of Object.entries(data.findings)) {
    if (!productIds[f.product]) continue
    highest = Math.max(highest, Number(key.split("-").pop()) || 0)
    await db.query(
      `insert into findings (org_id, key, product_id, title, severity, status, status_reason, cvss, description, steps,
         impact, evidence, recommendation, reference, affected_feature, found_while, environment, related_task,
         previous_test, discovery_method, target_release, late, late_cause, exploitation_suspected, found_on, due_on,
         retest_due_on, validated_at, reported_at, ready_for_retest_at, retest_requested_at, retest_completed_at, closed_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33)`,
      [demo.id, key, productIds[f.product], f.title, f.severity, f.status,
       f.statusReason || (exits.includes(f.status) ? "Imported without a recorded reason" : null),
       f.cvss ?? null, f.description ?? null, f.steps ?? null, f.impact ?? null, f.evidence ?? null,
       f.recommendation ?? null, f.reference ?? null, f.affectedFeature ?? null, f.foundWhile ?? null,
       f.environment ?? null, f.relatedTask ?? null, f.previousTest ?? null, f.discoveryMethod ?? null,
       f.targetRelease ?? null, !!f.late, f.lateCause ?? null, !!f.exploitationSuspected, day(f.found),
       day(f.due), day(f.retestDue), at(f.validatedAt), at(f.reportedAt), at(f.readyDate),
       at(f.retestRequestedAt), at(f.retestCompleted), at(f.closed)]
    )
  }
  await db.query(
    "update organizations set finding_prefix = 'SEC', next_finding_no = $2 where id = $1",
    [demo.id, highest + 1]
  )

  for (const e of data.events ?? [])
    await db.query(
      `insert into activity_events (org_id, product_id, type, body, occurred_on) values ($1,$2,$3,$4,$5)`,
      [demo.id, productIds[e.product] ?? null, e.type, e.text, day(e.date)]
    )
  for (const h of data.history ?? [])
    for (const [slug, pct] of Object.entries(h.cov ?? {}))
      if (productIds[slug])
        await db.query(
          `insert into coverage_snapshots (org_id, product_id, taken_on, coverage_pct) values ($1,$2,$3,$4)
           on conflict do nothing`,
          [demo.id, productIds[slug], day(h.date), pct]
        )
  // Product access, so testers and developers have something to work on.
  const slugs = Object.keys(productIds)
  for (const [email, count] of [["tester@demo.test", 3], ["dev@demo.test", 2], ["manager@demo.test", slugs.length]])
    for (const slug of slugs.slice(0, count))
      await db.query(
        `insert into product_members (org_id, product_id, user_id, access)
         select $1, $2, u.id, 'edit' from users u where u.email = $3
         on conflict do nothing`,
        [demo.id, productIds[slug], email]
      )
  console.log(`  Loaded data.json into Demo Company: ${Object.keys(productIds).length} products, ${Object.keys(data.findings).length} findings`)
}
