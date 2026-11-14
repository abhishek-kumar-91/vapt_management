# VAPT Security Dashboard

A Vite + React dashboard for reviewing sample vulnerability-assessment coverage, Jira findings, remediation activity and test-cycle dates. All records shipped in this repository are sample data; do not rely on them for operational decisions.

## Run locally

Requirements: Node.js 20.19+ or 22.12+.

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. Create a production build with `npm run build`; preview it with `npm run preview`.

## Dashboard features

- Portfolio overview with product search, risk-tier filter, coverage, open findings and risk scores.
- Severity and coverage charts, plan-vs-actual health, priority findings, retest queue, upcoming tier-based cycle dates and recent activity.
- Product detail pages with SOP task statuses, test method/result/date/ticket/blocker notes, time-box signals, product register fields and dynamically calculated coverage.
- SOP-formatted finding reports with required description, reproduction steps, impact, redacted evidence, severity/CVSS, affected feature, test environment, remediation and CWE/OWASP reference. Critical/High findings are escalated in the activity log on creation; finding exit statuses require a reason.
- **Request retest** moves an In Fix item to Ready for Retest, records the ready date and two-working-day due date, and logs the request. Configure the Security Tester address under **Workflow settings** to open a prefilled email draft.
- Daily, weekly, monthly and baseline close-out reports are generated from live records; reports can be downloaded as Markdown or saved to the local activity archive.
- Test-area, finding, product, cycle-date and report edits are saved in this browser's local storage. Use **Export JSON** to download the current dataset or **Reset sample data** to discard local edits.
- Product details can be opened directly with a `#p-<product-id>` URL fragment.

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

This dashboard displays security findings. Host it only behind authentication and HTTPS; do not publish real assessment data on a public site. `_headers` provides baseline security headers for Cloudflare Pages and Netlify. Review those headers against your hosting platform and deployment configuration.

Never put credentials, customer data or exploit details into the sample inputs. Keep repositories containing real findings private and restrict access to exported data.
