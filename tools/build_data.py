#!/usr/bin/env python3
"""Build data.json for the VAPT dashboard.

Inputs (all under --src, default tools/source):
  products.json   one object per product: status, tier, dates, test areas (hand maintained)
  events.json     list of short event lines
  history.json    list of weekly coverage snapshots (see --snapshot)
  config.json     {"base": "https://yourcompany.atlassian.net", "project": "SEC"}
and Jira CSV exports under --exports, one file per product, named <product-id>.csv
(Jira: Filters > your Vulnerability filter > Export > CSV (all fields)).

Usage:
  python3 tools/build_data.py                     # writes data.json
  python3 tools/build_data.py --snapshot          # also adds today's coverage to history.json
  python3 tools/build_data.py --out /path/data.json

Standard library only. No network access. Never put credentials or customer data in any input.
"""
import argparse
import csv
import datetime as dt
import io
import json
import re
import sys
from pathlib import Path

SEV_DAYS = {"Critical": 7, "High": 30, "Medium": 90, "Low": 0}
KEY_RE = re.compile(r"^[A-Za-z][A-Za-z0-9]+-\d+$")
MONTHS = {m: i + 1 for i, m in enumerate("jan feb mar apr may jun jul aug sep oct nov dec".split())}


def jdate(s):
    """Return YYYY-MM-DD from ISO or Jira style dates such as 12/Nov/26 10:30 AM."""
    s = (s or "").strip()
    if not s:
        return ""
    m = re.match(r"^(\d{4})-(\d{2})-(\d{2})", s)
    if m:
        return "%s-%s-%s" % m.groups()
    m = re.match(r"^(\d{1,2})[/\- ]([A-Za-z]{3})[a-z]*[/\- ](\d{2,4})", s)
    if m:
        y = int(m.group(3))
        y += 2000 if y < 100 else 0
        mo = MONTHS.get(m.group(2).lower())
        if mo:
            return "%04d-%02d-%02d" % (y, mo, int(m.group(1)))
    return ""


def add_days(iso, n):
    return (dt.date.fromisoformat(iso) + dt.timedelta(days=n)).isoformat()


def map_sev(s):
    s = (s or "").lower()
    if re.search(r"crit|blocker|highest", s):
        return "Critical"
    if re.search(r"high|major", s):
        return "High"
    if re.search(r"med|normal", s):
        return "Medium"
    return "Low"


def map_status(s):
    s = (s or "").lower()
    if re.search(r"retest|verify|verification", s):
        return "Ready for Retest"
    if re.search(r"risk accept", s):
        return "Risk Accepted"
    if re.search(r"won.?t", s):
        return "Won't Fix"
    if re.search(r"reject|invalid|duplicate", s):
        return "Rejected"
    if re.search(r"clos|done|resolv|fixed", s):
        return "Closed"
    if re.search(r"in fix|progress|fixing|develop", s):
        return "In Fix"
    if re.search(r"triage", s):
        return "Triaged"
    return "Open"


def read_findings(path, product, today):
    text = Path(path).read_text(encoding="utf-8-sig")
    rows = list(csv.reader(io.StringIO(text)))
    if len(rows) < 2:
        return {}
    head = [h.strip().lower() for h in rows[0]]

    def col(pred):
        for i, h in enumerate(head):
            if pred(h):
                return i
        return -1

    ik = col(lambda h: h in ("issue key", "key"))
    isum = col(lambda h: h == "summary")
    ist = col(lambda h: h == "status")
    isv = col(lambda h: "severity" in h)
    ipr = col(lambda h: h == "priority")
    ic = col(lambda h: h == "created")
    iu = col(lambda h: h == "updated")
    ir = col(lambda h: h == "resolved")
    idue = col(lambda h: h == "due date")
    ilab = [i for i, h in enumerate(head) if h == "labels"]
    if ik < 0 or isum < 0:
        sys.exit("%s: needs 'Issue key' and 'Summary' columns" % path)

    def cell(r, i):
        return r[i] if 0 <= i < len(r) else ""

    out = {}
    for r in rows[1:]:
        key = cell(r, ik).strip().upper()
        if not KEY_RE.match(key):
            continue
        sev = map_sev(cell(r, isv) if isv >= 0 else cell(r, ipr))
        status = map_status(cell(r, ist))
        found = jdate(cell(r, ic))
        due = jdate(cell(r, idue))
        if not due and found and SEV_DAYS[sev]:
            due = add_days(found, SEV_DAYS[sev])
        doc = {
            "product": product,
            "title": cell(r, isum)[:200],
            "severity": sev,
            "status": status,
            "found": found,
            "due": due,
            "readyDate": "",
            "closed": "",
            "late": any("late-finding" in cell(r, i).lower() for i in ilab),
        }
        if status == "Ready for Retest":
            doc["readyDate"] = jdate(cell(r, iu)) or today
        if status in ("Closed", "Rejected", "Risk Accepted", "Won't Fix"):
            doc["closed"] = jdate(cell(r, ir)) or jdate(cell(r, iu)) or today
        out[key] = doc
    return out


def load(path, default):
    p = Path(path)
    return json.loads(p.read_text(encoding="utf-8")) if p.exists() else default


def coverage(areas):
    return round(100.0 * sum(1 for a in areas if a.get("s") == "Tested") / len(areas), 1) if areas else None


def main():
    here = Path(__file__).resolve().parent
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--src", default=str(here / "source"))
    ap.add_argument("--exports", default=str(here / "exports"))
    ap.add_argument("--out", default=str(here.parent / "data.json"))
    ap.add_argument("--today", default=dt.date.today().isoformat(), help="override today's date (YYYY-MM-DD)")
    ap.add_argument("--snapshot", action="store_true", help="append today's coverage to history.json")
    a = ap.parse_args()
    src, today = Path(a.src), a.today

    products = load(src / "products.json", {})
    events = load(src / "events.json", [])
    history = load(src / "history.json", [])
    config = load(src / "config.json", {"base": "", "project": ""})

    findings = {}
    for pid in products:
        f = Path(a.exports) / (pid + ".csv")
        if f.exists():
            findings.update(read_findings(f, pid, today))
        else:
            print("note: no export for %s (%s)" % (pid, f.name), file=sys.stderr)

    if a.snapshot:
        cov = {pid: coverage(p.get("areas", [])) for pid, p in products.items()}
        cov = {k: v for k, v in cov.items() if v is not None}
        history = [h for h in history if h.get("date") != today] + [{"date": today, "cov": cov}]
        history.sort(key=lambda h: h["date"])
        (src / "history.json").write_text(json.dumps(history, indent=2) + "\n", encoding="utf-8")

    out = {
        "generated": today,
        "config": config,
        "products": products,
        "findings": findings,
        "events": events,
        "history": history,
    }
    Path(a.out).write_text(json.dumps(out, indent=2) + "\n", encoding="utf-8")
    print("wrote %s: %d products, %d findings, %d events, %d snapshots"
          % (a.out, len(products), len(findings), len(events), len(history)))


if __name__ == "__main__":
    main()
