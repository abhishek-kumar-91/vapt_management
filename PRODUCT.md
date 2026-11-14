# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary: the in-house **Security Tester** who works through vulnerability-assessment (VAPT) baselines product by product. Daily, they mark test areas, record methods and results, raise SOP-formatted findings, and turn around retests. Secondary: the **Manager**, who reads health, plan-vs-actual and the generated daily/weekly/monthly/close-out reports and approves status switches. Third: **developers / dev leads**, who move findings to In Fix and request retests.

## Product Purpose

Sentinel is a single place to track application-security testing against the internal Application Security Testing SOP v1.0: per-product coverage of test areas (with priority/high-risk coverage), validated findings and their fix deadlines, retest turnaround, tier-based test cycles, and the reports the SOP requires. Success means the tester always knows what to test next, nothing breaches an SLA unnoticed, and reports come straight from the records.

## Positioning

The workflow rules are the SOP itself, not generic issue tracking: coverage is computed against SOP close-out criteria (100% priority, ≥80% overall), fix deadlines and retest targets are SOP timings, exit statuses demand reasons, status switches demand Manager-approved handover text, and health (Red/Amber/Green) is derived from those rules.

## Operating Context

- Desk work during office hours, on a laptop or external monitor; occasional phone check of status.
- Findings mirror Jira tickets (project key `SEC`); data is built from Jira CSV exports by `tools/build_data.py` into `data.json`.
- Edits live in the browser's localStorage only; Export JSON / Reset sample data are the escape hatches. Retest requests open a mailto draft to a configured tester address.

## Capabilities and Constraints

- Products, test areas (To Do / In Testing / Blocked / Tested), findings (Open → Triaged → In Fix → Ready for Retest → Closed, plus Rejected / Risk Accepted / Won't Fix with reasons), cycles, events, history snapshots, saved reports.
- No backend, auth, or shared storage; the app must be hosted behind authentication and HTTPS. All shipped data is sample data and must be labelled as such.
- Never show credentials, customer data or unredacted evidence.

## Brand Commitments

- Name: **Sentinel** (Security Console), with its shield-and-check mark. Confirmed by the user 2026-11-14.
- Pinned by the user: Next.js (latest, App Router), Figtree typeface, shadcn/ui **Luma** style, fully rounded, clean product look.

## Evidence on Hand

`data.json` (sample products, findings, events, history), `tools/source/*`, `tools/exports/*.csv`. No real customers, metrics or testimonials exist; none may be invented.

## Product Principles

1. The tester's next action is always one click away; overview is a work queue, not a poster.
2. SOP rules are enforced in the UI, with the reason shown when an action is refused.
3. Status is colour plus words, never colour alone.
4. Sample data is always labelled sample data.

## Accessibility & Inclusion

WCAG 2.2 AA: keyboard-operable controls, visible focus, ≥4.5:1 text contrast, health and severity never conveyed by colour alone.
