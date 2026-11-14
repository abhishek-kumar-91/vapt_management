# VAPT Security Dashboard

A Next.js (App Router) dashboard for reviewing sample vulnerability-assessment coverage, Jira findings, remediation activity and test-cycle dates. All records shipped in this repository are sample data; do not rely on them for operational decisions.

## Run locally

Requirements: Node.js 20.9+ and pnpm (version pinned in `packageManager`; `corepack enable` picks it up).

```sh
pnpm install
pnpm dev
```

Open http://localhost:3000. `/` currently redirects to `/login` (the home page comes later); signing in opens the console at `/dashboard`. Sign-in is not connected to an identity provider yet, so any well-formed email and password opens the dashboard. Create a production build with `pnpm build` and serve it with `pnpm start`. `pnpm typecheck`, `pnpm lint` and `pnpm format` are also available.

## Stack and structure

Next.js 16 (App Router, TypeScript), Tailwind CSS v4, shadcn/ui (`radix-luma` style), Figtree via `next/font`, lucide icons, Recharts for the coverage trend.

```
app/
  layout.tsx              root: fonts, theme, toasts
  page.tsx                placeholder for the home page; redirects to /login
  login/                  sign-in page
  dashboard/layout.tsx    sidebar shell + data provider
  dashboard/page.tsx      overview
  dashboard/findings/     finding register
  dashboard/products/[id] product detail (areas, findings, cycles, register, history)
  dashboard/reports/      report builder + archive
  dashboard/activity/     audit trail
  dashboard/settings/     retest routing + SOP rules
components/               app components (overview/, findings/, products/) and ui/ (shadcn)
lib/                      types, SOP rules, dates, metrics, report builders, client store
proxy.ts                  per-request CSP nonce + security headers
```

All SOP rules live in `lib/sop.ts`; computed metrics and health in `lib/metrics.ts`; every state change goes through the actions in `lib/store.tsx`.

## Dashboard features

- Portfolio overview with product search, risk-tier filter, coverage, open findings and risk scores.
- Severity and coverage charts, plan-vs-actual health, priority findings, retest queue, upcoming tier-based cycle dates and recent activity.
- Product detail pages with SOP task statuses, test method/result/date/ticket/blocker notes, time-box signals, product register fields and dynamically calculated coverage.
- SOP-formatted finding reports with required description, reproduction steps, impact, redacted evidence, severity/CVSS, affected feature, test environment, remediation and CWE/OWASP reference. Critical/High findings are escalated in the activity log on creation; finding exit statuses require a reason.
- **Request retest** moves an In Fix item to Ready for Retest, records the ready date and two-working-day due date, and logs the request. Configure the Security Tester address under **Workflow settings** to open a prefilled email draft.
- Daily, weekly, monthly and baseline close-out reports are generated from live records; reports can be downloaded as Markdown or saved to the local activity archive.
- Test-area, finding, product, cycle-date and report edits are saved in this browser's local storage. Use **Export JSON** or **Reset sample data** from the account menu (top right).
- **Settings → Appearance** switches between the default shell and a dark sidebar with light content; the choice is saved in a cookie.
- Product details live at `/dashboard/products/<product-id>`; old `#p-<product-id>` links are redirected there.

The UI uses the bundled [`data.json`](./data.json) file as sample data. The interface does not call Jira or any other API. Browser edits are local only and are not written back to `data.json`. Local storage is per browser and device, not shared between users. Email notification uses the user's configured email client; it does not send automatically. Shared team access, central storage, login and automatic email delivery require a separately deployed authenticated backend and mail service.

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
