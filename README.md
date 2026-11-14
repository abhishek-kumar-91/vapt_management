# VAPT Security Dashboard

A Next.js (App Router) dashboard for reviewing sample vulnerability-assessment coverage, Jira findings, remediation activity and test-cycle dates. All records shipped in this repository are sample data; do not rely on them for operational decisions.

## Run locally

Requirements: Node.js 24+, pnpm (pinned in `packageManager`; `corepack enable` picks it up), and Postgres (local, or Neon).

```sh
pnpm install
cp .env.example .env                      # local databases are set up below
createdb vapt_dev && createdb vapt_test
psql -d postgres -c "create role vapt_app login password 'vapt_app_local'"   # once per machine
pnpm db:reset                             # migrate vapt_dev (as the owner, MIGRATION_DATABASE_URL)
psql -d postgres -c "grant app_user to vapt_app"                             # once, after the first migrate
pnpm db:seed --domain                     # demo companies, people and the sample products
pnpm dev
```

Sign in at http://localhost:3000/login. The seed prints every account; they all use the password `scout-demo-2026!`. `admin@pentestscout.test` is a Super Admin (`/admin`), and `owner@demo.test` opens Demo Company (`/o/demo`). Register a new company at `/signup`.

| Command | What it does |
|---|---|
| `pnpm test` | Vitest against `TEST_DATABASE_URL`, which is wiped and migrated each run: roles, tenancy, row-level security, domain rules |
| `pnpm typecheck` · `pnpm lint` · `pnpm build` | The gate before merging |
| `pnpm db:generate` | After editing `db/schema/*`, write a migration |
| `pnpm db:migrate` · `pnpm db:reset` | Apply migrations · wipe and re-migrate (refuses non-local databases unless `ALLOW_DB_RESET=1`) |
| `pnpm user:create --email … --name …` | Create a Pentest Scout Super Admin (the only way to get one) |
| `pnpm docs:dev` | Developer documentation (Docusaurus) on http://localhost:3001 |

## Architecture

Multi-company: companies sign themselves up, a Super Admin approves them, and each company tracks its own products with its own team. Full design: [docs/database-architecture.md](docs/database-architecture.md). Build log: [docs/integration-plan.md](docs/integration-plan.md).

```
app/
  signup · verify · invite · forgot-password · set-password · login    public account flows
  onboarding/                company profile → products → submit for review
  o/[org]/                   the company console (overview, products, findings, reports,
                             activity, testing, team, settings)
  admin/                     Super Admins: approvals, companies, testing requests, sign-ups,
                             products, users, outbox, audit log
  api/                       health · o/[org]/members · o/[org]/export · cron/daily
server/                      all data access: context (who, which company, scope), members, orgs,
                             products, domain, testing, admin, stats
lib/auth/                    sessions, passwords, roles (the permission matrix), tokens, audit
lib/email/                   templates + outbox (no provider yet; links are copied from Admin → Outbox)
db/schema · db/migrations    Drizzle schema; 0001_guards.sql holds triggers, RLS policies and grants
```

- **Every** server function takes a context built from the session and the database (never from the browser), checks the role and product access, runs in a scoped transaction, and writes an audit row.
- **Keeping companies apart:** the request context, composite foreign keys, and Postgres row-level security. The app connects as `vapt_app` (a member of `app_user`), so the database itself refuses cross-company reads and writes.
- **Roles:** Super Admin (platform), then Owner, Manager, Security Tester and Developer per company. Owners set per-product **view** or **edit** access for everyone else. Rules live in `lib/auth/roles.ts`.
- **Email** is built but not sending: every email is queued in `email_outbox`. In development the link is printed in the server console (and shown on screen where it was created). In production it waits in Admin → Outbox.

## Dashboard features

- Portfolio overview with product search, risk-tier filter, coverage, open findings and risk scores.
- Severity and coverage charts, plan-vs-actual health, priority findings, retest queue, upcoming tier-based cycle dates and recent activity.
- Product detail pages with SOP task statuses, test method/result/date/ticket/blocker notes, time-box signals, product register fields and dynamically calculated coverage.
- SOP-formatted finding reports with required description, reproduction steps, impact, redacted evidence, severity/CVSS, affected feature, test environment, remediation and CWE/OWASP reference. Critical/High findings are escalated in the activity log on creation; finding exit statuses require a reason.
- **Request retest** moves an In Fix item to Ready for Retest, records the ready date and the two-working-day due date, and logs the request. An Owner sets the retest email under **Settings → Company** so the draft opens prefilled.
- Daily, weekly, monthly and baseline close-out reports are generated from live records; reports can be downloaded as Markdown or saved to the company archive.
- Every edit is saved to the database for the whole team, according to each person's access. **Export data** (account menu or Settings) downloads what you can see, and the export is recorded in the audit log.
- **Settings → Appearance** switches between the default shell and a dark sidebar with light content; the choice is saved in a cookie.
- Product details live at `/o/<company>/products/<product>`. Old `/dashboard/...` links redirect to your company.

[`data.json`](./data.json) is sample data, used only by `pnpm db:seed --domain`. The interface doesn't call Jira or any other API. Retest requests open a prefilled draft in your own email app; automatic email delivery is phase 10.

Workflow rules follow the attached Application Security Testing SOP v1.0: task and priority coverage, baseline close-out criteria, severity fix deadlines, retest turnaround, tier-specific cycles, manager-approved status handovers, blocker reasons, and daily/weekly/monthly reporting. Cycle targets are starting values and should be reviewed with the Manager as specified by the SOP. Weekly snapshots are recorded when a weekly report is saved.

## Data pipeline

The Python standard-library script and Jira CSV examples remain available:

```sh
python tools/build_data.py
python tools/build_data.py --snapshot
```

Edit product metadata and test areas in `tools/source/products.json`, activity in `tools/source/events.json`, history in `tools/source/history.json`, Jira settings in `tools/source/config.json`, and replace each sample export under `tools/exports/`. Then rebuild `data.json`. Keep the sample fields and CSV column requirements documented in the source files and script.

## Deployment and data handling

This dashboard displays security findings. Host it only behind authentication and HTTPS; do not publish real assessment data on a public site. `proxy.ts` sets a nonce-based Content-Security-Policy and baseline security headers on every page response, so pages are rendered per request (run it with `next start` or a platform that supports Next.js proxy). Review those headers against your hosting configuration.

Never put credentials, customer data or exploit details into the sample inputs. Keep repositories containing real findings private and restrict access to exported data.
