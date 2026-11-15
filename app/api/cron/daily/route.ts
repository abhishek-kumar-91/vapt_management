import { timingSafeEqual } from "node:crypto"

import { sql } from "drizzle-orm"

import { withSystem } from "@/server/context"
import { rebuildAllOrgStats } from "@/server/stats"

/**
 * Daily housekeeping (Vercel Cron, see vercel.json). Vercel sends `Authorization: Bearer
 * <CRON_SECRET>`; anything else gets a 401.
 *   - rebuild every company's admin totals (overdue counts change as days pass)
 *   - take today's coverage snapshot for every live product (the trend charts)
 *   - blank links in emails whose token has expired or that were sent long ago
 *   - delete one-time tokens that expired more than a week ago
 */
function authorized(request: Request) {
  const secret = process.env.CRON_SECRET
  const given = request.headers.get("authorization") ?? ""
  const expected = `Bearer ${secret}`
  return (
    !!secret &&
    secret.length >= 16 &&
    given.length === expected.length &&
    timingSafeEqual(Buffer.from(given), Buffer.from(expected))
  )
}

export async function GET(request: Request) {
  if (!authorized(request)) return Response.json({ error: "Unauthorized" }, { status: 401 })
  const started = Date.now()
  try {
    const companies = await rebuildAllOrgStats()
    const snapshots = await withSystem((tx) =>
      tx.execute(sql`
        insert into coverage_snapshots (org_id, product_id, taken_on, coverage_pct)
        select p.org_id, p.id, current_date,
          round(100.0 * count(*) filter (where a.status = 'Tested') / count(*))::smallint
        from products p
        join organizations o on o.id = p.org_id and o.status = 'active'
        join test_areas a on a.product_id = p.id
        where p.archived_at is null
        group by p.org_id, p.id
        on conflict (product_id, taken_on) do update set coverage_pct = excluded.coverage_pct`)
    )
    const purged = await withSystem((tx) =>
      tx.execute(sql`
        update email_outbox
        set link = null, body_text = null, body_html = null,
            status = case when status = 'pending' then 'cancelled'::email_status else status end
        where link is not null
          and ((expires_at is not null and expires_at < now())
            or (status = 'sent' and sent_at < now() - interval '7 days'))`)
    )
    const tokens = await withSystem((tx) =>
      tx.execute(sql`delete from auth_tokens where expires_at < now() - interval '7 days'`)
    )
    const result = {
      ok: true,
      companies,
      snapshots: snapshots.rowCount,
      emailsBlanked: purged.rowCount,
      tokensDeleted: tokens.rowCount,
      ms: Date.now() - started,
    }
    console.info("[cron:daily]", result)
    return Response.json(result)
  } catch (error) {
    console.error("[cron:daily] failed", error)
    return Response.json({ ok: false }, { status: 500 })
  }
}
