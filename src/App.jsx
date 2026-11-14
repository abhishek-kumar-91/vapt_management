import React, { useEffect, useMemo, useState } from 'react';
import sampleData from '../data.json';

const STORAGE_KEY = 'vapt-dashboard-data-v1';
const PRODUCT_ORDER = [
  'remplatforms-wallet',
  'storesofindia',
  'indiandeliverypartners',
  'reminterns',
  'remlearners',
];
const COLORS = ['#5667e8', '#e68748', '#18a77c', '#d2a12b', '#d46b9a'];
const SEVERITIES = ['Critical', 'High', 'Medium', 'Low'];
const SEVERITY_COLORS = {
  Critical: '#dc4d55',
  High: '#ed8b52',
  Medium: '#dcae3c',
  Low: '#5790d8',
};
const AREA_STATUSES = ['To Do', 'In Testing', 'Blocked', 'Tested'];
const FINDING_STATUSES = [
  'Open',
  'Triaged',
  'In Fix',
  'Ready for Retest',
  'Closed',
  'Rejected',
  'Risk Accepted',
  "Won't Fix",
];
const PRODUCT_STATUSES = ['Not started', 'In progress', 'Paused', 'Baseline complete', 'Continuous'];
const EXIT_STATUSES = ['Rejected', 'Risk Accepted', "Won't Fix"];
const SEVERITY_DAYS = { Critical: 7, High: 30, Medium: 90 };
const CYCLE_RULES = [
  { key: 'baseline', title: 'Baseline test', months: { 1: 12, 2: 12, 3: 12 }, source: 'baseline' },
  { key: 'release', title: 'New-feature security review', eventBased: true, source: 'release' },
  { key: 'regression', title: 'Regression test', months: { 1: 1, 2: 3, 3: 6 }, source: 'regression' },
  { key: 'auth', title: 'Authentication retest', months: { 1: 3, 2: 6, 3: 12 }, source: 'auth' },
  { key: 'dep', title: 'Dependency scan', days: { 1: 7, 2: 7, 3: 30 }, source: 'dep' },
  { key: 'config', title: 'Configuration review', months: { 1: 3, 2: 6, 3: 12 }, source: 'config' },
  { key: 'register', title: 'Product register review', months: { 1: 1, 2: 1, 3: 1 }, source: 'register' },
];

function readSavedData() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return sampleData;
    const parsed = JSON.parse(saved);
    if (!parsed || typeof parsed.products !== 'object' || typeof parsed.findings !== 'object') {
      throw new Error('Saved dashboard data is missing required product or finding records.');
    }
    return {
      ...sampleData,
      ...parsed,
      config: { ...sampleData.config, ...parsed.config },
      reports: Array.isArray(parsed.reports) ? parsed.reports : [],
      events: Array.isArray(parsed.events) ? parsed.events : [],
      history: Array.isArray(parsed.history) ? parsed.history : [],
    };
  } catch (error) {
    console.error('Unable to load saved dashboard data; using the bundled sample data.', error);
    return sampleData;
  }
}

function persistData(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('Unable to save dashboard data in this browser.', error);
  }
}

function formatDate(value, options = { day: 'numeric', month: 'short' }) {
  if (!value) return '—';
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('en-GB', options).format(date);
}

function todayIso() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function isWorkday(date) {
  return date.getDay() !== 0 && date.getDay() !== 6;
}

function workdaysBetween(from, to) {
  if (!from || !to || from >= to) return 0;
  const date = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  let count = 0;
  while (date < end) {
    date.setDate(date.getDate() + 1);
    if (date <= end && isWorkday(date)) count += 1;
  }
  return count;
}

function addWorkdays(from, count) {
  if (!from) return '';
  const date = new Date(`${from}T00:00:00`);
  let added = 0;
  while (added < count) {
    date.setDate(date.getDate() + 1);
    if (isWorkday(date)) added += 1;
  }
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function addMonths(value, count) {
  if (!value) return '';
  const date = new Date(`${value}T00:00:00Z`);
  const originalDay = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + count);
  const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(originalDay, lastDay));
  return date.toISOString().slice(0, 10);
}

function addDays(value, count) {
  if (!value) return '';
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + count);
  return date.toISOString().slice(0, 10);
}

function dateDiff(from, to) {
  if (!from || !to) return 0;
  return Math.round((new Date(`${to}T00:00:00`) - new Date(`${from}T00:00:00`)) / 86400000);
}

function isClosed(finding) {
  return ['Closed', 'Rejected', 'Risk Accepted', "Won't Fix"].includes(finding.status);
}

function productColor(id) {
  const knownIndex = PRODUCT_ORDER.indexOf(id);
  return COLORS[knownIndex < 0 ? 0 : knownIndex];
}

function metricsFor(product, findings) {
  const areas = product.areas || [];
  const highRisk = areas.filter((area) => area.hr);
  const tested = areas.filter((area) => area.s === 'Tested').length;
  const priorityTested = highRisk.filter((area) => area.s === 'Tested').length;
  const productFindings = findings.filter((finding) => finding.product === product.id);
  const open = productFindings.filter((finding) => !isClosed(finding));
  const count = Object.fromEntries(
    SEVERITIES.map((severity) => [severity, open.filter((finding) => finding.severity === severity).length]),
  );
  const risk = (count.Critical * 10 + count.High * 5 + count.Medium * 2 + count.Low * 0.5)
    * ({ 1: 3, 2: 2, 3: 1 }[product.tier] || 1);
  const today = todayIso();
  const overdueCritical = open.some((finding) => finding.severity === 'Critical' && finding.due && finding.due < today);
  const overdueHigh = open.some((finding) => finding.severity === 'High' && finding.due && finding.due < today);
  const overdueRetest = productFindings.some((finding) => {
    const retestDue = finding.retestDue || (finding.readyDate ? addWorkdays(finding.readyDate, 2) : '');
    return finding.status === 'Ready for Retest' && !!retestDue && retestDue < today;
  });
  const coverage = areas.length ? Math.round((tested / areas.length) * 100) : 0;
  const priorityCoverage = highRisk.length ? Math.round((priorityTested / highRisk.length) * 100) : 0;
  const started = product.baselineStart;
  const estimate = Math.max(1, Number(product.estDays) || 7);
  const elapsedWorkdays = started ? workdaysBetween(started, today) + (started <= today && isWorkday(new Date(`${started}T00:00:00`)) ? 1 : 0) : 0;
  const planned = product.status === 'In progress' && started
    ? Math.min(100, Math.round((elapsedWorkdays / estimate) * 100))
    : coverage;
  const behind = product.status === 'In progress' ? Math.max(0, planned - coverage) : 0;
  const endDate = started ? addWorkdays(started, estimate) : '';
  const overdueCycle = cycleRows(product).some((row) => row.next && row.next < today && !row.eventBased);
  const missedBaseline = product.status === 'In progress' && endDate < today && coverage < 80;
  const missedStart = product.status === 'Not started' && started && started < today;
  const missedResume = product.status === 'Paused' && product.resumeOn && product.resumeOn < today;
  const stalled = product.status === 'In progress' && product.lastTested && workdaysBetween(product.lastTested, today) >= 3;
  let health = 'Green';
  if (overdueCritical || behind > 20 || overdueCycle || missedBaseline || missedStart || missedResume) health = 'Red';
  else if (overdueHigh || overdueRetest || behind > 0 || product.status === 'Paused' || stalled) health = 'Amber';
  if (product.status === 'Not started' && !missedStart) health = 'Not started';
  else if (product.status === 'Paused' && health !== 'Red') health = 'Paused';
  return {
    areas: areas.length,
    tested,
    highRisk: highRisk.length,
    priorityTested,
    coverage,
    priorityCoverage,
    findings: productFindings,
    open,
    count,
    risk,
    health,
    overdueCritical,
    overdueHigh,
    overdueRetest,
    planned,
    behind,
    elapsedWorkdays,
    endDate,
    overdueCycle,
    stalled,
    missedStart,
    missedResume,
  };
}

function cycleRows(product) {
  return CYCLE_RULES.map((rule) => {
    const done = product.done || {};
    const last = done[rule.source]
      || (rule.source === 'baseline' ? product.closeout || product.baselineStart : '')
      || (rule.source === 'register' ? product.lastTested : '');
    const interval = rule.months?.[product.tier];
    const next = last && !rule.eventBased
      ? (rule.days ? addDays(last, rule.days[product.tier]) : addMonths(last, interval))
      : '';
    return {
      ...rule,
      last,
      next,
      eventBased: !!rule.eventBased,
      frequency: rule.eventBased ? 'Every release' : rule.days
        ? (rule.days[product.tier] === 7 ? 'Weekly' : 'Monthly')
        : ({ 1: 'Monthly', 3: 'Quarterly', 6: 'Every 6 months', 12: 'Yearly' }[interval] || `${interval} months`),
    };
  });
}

function Badge({ children, tone = '' }) {
  return <span className={`badge ${tone}`}>{children}</span>;
}

function MetricCard({ label, value, note, icon, tone = '' }) {
  return (
    <article className="metric-card">
      <div className={`metric-icon ${tone}`}>{icon}</div>
      <div className="metric-content">
        <span className="eyebrow">{label}</span>
        <strong>{value}</strong>
        {note && <span className="metric-note">{note}</span>}
      </div>
    </article>
  );
}

function SeverityBreakdown({ metrics }) {
  const total = metrics.open.length;
  return (
    <div className="severity-breakdown" aria-label={`${total} open findings`}>
      {SEVERITIES.map((severity) => (
        <span className={!metrics.count[severity] ? 'severity-zero' : ''} key={severity}>
          <i style={{ backgroundColor: SEVERITY_COLORS[severity] }} />
          {metrics.count[severity]}
        </span>
      ))}
    </div>
  );
}

function HealthBadge({ health }) {
  const className = health === 'Green' ? 'healthy' : health === 'Red' ? 'critical' : health === 'Paused' ? 'paused' : health === 'Not started' ? 'neutral' : 'attention';
  return <Badge tone={className}><i className="health-dot" />{health}</Badge>;
}

function FindingStatusControl({ finding, onChange }) {
  const [pendingStatus, setPendingStatus] = useState('');
  const [reason, setReason] = useState('');
  const change = (status) => {
    if (EXIT_STATUSES.includes(status)) {
      setPendingStatus(status);
      setReason(finding.statusReason || '');
      return;
    }
    setPendingStatus('');
    onChange(finding.id, status);
  };
  return (
    <div className="status-control">
      <select className="status-select" value={pendingStatus || finding.status} aria-label={`Status for ${finding.id}`} onChange={(event) => change(event.target.value)}>
        {FINDING_STATUSES.map((status) => <option key={status}>{status}</option>)}
      </select>
      {pendingStatus && <div className="status-reason-editor">
        <input aria-label={`Reason for ${pendingStatus} ${finding.id}`} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Required reason / Manager approval" />
        <button className="button-primary compact" disabled={!reason.trim()} onClick={() => { onChange(finding.id, pendingStatus, reason.trim()); setPendingStatus(''); }}>Save</button>
        <button className="text-button" onClick={() => setPendingStatus('')}>Cancel</button>
      </div>}
      {finding.statusReason && !pendingStatus && <small className="late-label">Exit reason recorded</small>}
    </div>
  );
}

function CoverageBar({ value }) {
  return (
    <div className="coverage-track" role="progressbar" aria-valuenow={value} aria-valuemin="0" aria-valuemax="100">
      <span style={{ width: `${value}%` }} />
      <i />
    </div>
  );
}

function ProductTable({ products, findings, onSelect }) {
  return (
    <div className="table-scroll">
      <table className="product-table">
        <thead>
          <tr>
            <th>Product</th><th>Coverage</th><th>Priority</th><th>Open findings</th><th>Risk score</th><th>Health</th>
          </tr>
        </thead>
        <tbody>
          {products.map((product) => {
            const metrics = metricsFor(product, findings);
            return (
              <tr key={product.id} className="clickable-row" onClick={() => onSelect(product.id)}>
                <td>
                  <button className="product-name" onClick={(event) => { event.stopPropagation(); onSelect(product.id); }}>
                    <span className="product-mark" style={{ background: productColor(product.id) }} />
                    <span><strong>{product.name}</strong><small>Tier {product.tier} · {product.status}</small></span>
                  </button>
                </td>
                <td className="coverage-cell">
                  <strong>{metrics.coverage}%</strong>
                  <CoverageBar value={metrics.coverage} />
                  <small>{metrics.tested}/{metrics.areas} areas</small>
                </td>
                <td><span className="priority-value">{metrics.priorityCoverage}%</span><small className="cell-caption">{metrics.priorityTested}/{metrics.highRisk} high-risk</small></td>
                <td><SeverityBreakdown metrics={metrics} /></td>
                <td><strong className="risk-value">{metrics.risk.toFixed(1)}</strong></td>
                <td><HealthBadge health={metrics.health} /></td>
              </tr>
            );
          })}
          {!products.length && <tr><td className="empty-cell" colSpan="6">No products match these filters.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function FindingsChart({ products, findings }) {
  if (!products.length) return <p className="empty-state">No product data to chart.</p>;
  return (
    <div className="bar-chart">
      {products.map((product) => {
        const metrics = metricsFor(product, findings);
        const total = Math.max(1, metrics.open.length);
        return (
          <div className="bar-row" key={product.id}>
            <span className="bar-label" title={product.name}>{product.name}</span>
            <div className="bar-stack" aria-label={`${metrics.open.length} open findings`}>
              {SEVERITIES.map((severity) => metrics.count[severity] > 0 && (
                <span key={severity} style={{ width: `${(metrics.count[severity] / total) * 100}%`, background: SEVERITY_COLORS[severity] }} title={`${severity}: ${metrics.count[severity]}`} />
              ))}
              {!metrics.open.length && <span className="bar-empty" />}
            </div>
            <strong>{metrics.open.length}</strong>
          </div>
        );
      })}
      <div className="chart-legend">{SEVERITIES.map((severity) => <span key={severity}><i style={{ background: SEVERITY_COLORS[severity] }} />{severity}</span>)}</div>
    </div>
  );
}

function CoverageChart({ products, history }) {
  const points = history.slice(-8).map((snapshot) => {
    const values = products.map((product) => snapshot.cov?.[product.id]).filter((value) => Number.isFinite(value));
    return { date: snapshot.date, value: values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null };
  }).filter((point) => point.value !== null);
  if (points.length < 2) {
    return <div className="chart-empty"><span className="chart-empty-icon">↗</span><p>Coverage trends appear once weekly snapshots are available.</p></div>;
  }
  const coords = points.map((point, index) => ({
    x: 16 + (index * 268) / (points.length - 1),
    y: 120 - (Math.min(100, point.value) * 0.94),
    ...point,
  }));
  const line = coords.map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`).join(' ');
  const area = `${line} L 284 132 L 16 132 Z`;
  return (
    <div className="line-chart">
      <svg viewBox="0 0 300 150" role="img" aria-label="Average test coverage over time">
        {[25, 50, 75, 100].map((value) => <g key={value}><line x1="16" x2="284" y1={120 - value * 0.94} y2={120 - value * 0.94} /><text x="0" y={124 - value * 0.94}>{value}</text></g>)}
        <path className="chart-area" d={area} />
        <path className="chart-line" d={line} />
        {coords.map((point) => <circle key={point.date} cx={point.x} cy={point.y} r="3.5"><title>{formatDate(point.date, { day: 'numeric', month: 'short' })}: {Math.round(point.value)}%</title></circle>)}
      </svg>
      <div className="chart-axis"><span>{formatDate(points[0].date)}</span><span>{formatDate(points.at(-1).date)}</span></div>
    </div>
  );
}

function nextFindingId(findings, project = 'SEC') {
  const prefix = `${project}-`;
  const greatest = findings.reduce((max, finding) => {
    if (!finding.id?.startsWith(prefix)) return max;
    const number = Number(finding.id.slice(prefix.length));
    return Number.isFinite(number) ? Math.max(max, number) : max;
  }, 0);
  return `${prefix}${greatest + 1}`;
}

function isFindingComplete(finding) {
  const required = ['title', 'description', 'steps', 'impact', 'evidence', 'severity', 'cvss', 'recommendation', 'reference', 'affectedFeature', 'foundWhile', 'environment', 'relatedTask'];
  return required.every((field) => String(finding[field] || '').trim())
    && (!finding.late || ['previousTest', 'discoveryMethod', 'lateCause'].every((field) => String(finding[field] || '').trim()))
    && (!EXIT_STATUSES.includes(finding.status) || !!finding.statusReason?.trim());
}

function buildFindingReport(finding, product) {
  const deadline = finding.due || (finding.severity === 'Low' ? `Next release${finding.targetRelease ? ` (${finding.targetRelease})` : ''}` : 'Not set');
  return [
    `# [${product.name}][${finding.affectedFeature || 'Feature'}][${finding.severity}] ${finding.title}`,
    '',
    `Ticket: ${finding.id}`,
    `Status: ${finding.status}`,
    `CVSS vector: ${finding.cvss || 'Not recorded'}`,
    `CWE / OWASP: ${finding.reference || 'Not recorded'}`,
    `Affected feature: ${finding.affectedFeature || 'Not recorded'}`,
    `Linked test task: ${finding.relatedTask || 'Not recorded'}`,
    `Found while testing: ${finding.foundWhile || 'Not recorded'}`,
    `Environment: ${finding.environment || 'Not recorded'}`,
    `Validated: ${finding.validatedAt || finding.found || 'Not recorded'}`,
    `Fix deadline: ${deadline}`,
    `Retest date: ${finding.retestCompleted || finding.retestDate || 'Not recorded'}`,
    '',
    '## Description',
    finding.description || 'Not recorded',
    '',
    '## Steps to reproduce',
    finding.steps || 'Not recorded',
    '',
    '## Impact',
    finding.impact || 'Not recorded',
    '',
    '## Redacted evidence',
    finding.evidence || 'Not recorded',
    '',
    '## Recommendation',
    finding.recommendation || 'Not recorded',
    '',
    `Exit / status reason: ${finding.statusReason || 'Not applicable'}`,
    `Late finding: ${finding.late ? `Yes — cause ${finding.lateCause || 'not recorded'}; previously tested ${finding.previousTest || 'date not recorded'}; discovered by ${finding.discoveryMethod || 'method not recorded'}` : 'No'}`,
    '',
    'Confidential — internal use only. Evidence must not contain credentials or customer data.',
  ].join('\n');
}

function coverageSnapshot(products, date = todayIso()) {
  const cov = {};
  products.forEach(([id, product]) => {
    const areas = product.areas || [];
    if (areas.length) cov[id] = Math.round((areas.filter((area) => area.s === 'Tested').length / areas.length) * 100);
  });
  return { date, cov };
}

function FindingForm({ product, onCancel, onCreate }) {
  const [values, setValues] = useState({
    title: '',
    affectedFeature: product.areas?.[0]?.n || '',
    foundWhile: product.areas?.[0]?.n || '',
    relatedTask: product.areas?.[0]?.j || '',
    severity: 'Medium',
    cvss: '',
    description: '',
    steps: '',
    impact: '',
    evidence: '',
    environment: '',
    reference: '',
    recommendation: '',
    late: false,
    previousTest: '',
    discoveryMethod: '',
    lateCause: 'New method',
    targetRelease: '',
    exploitationSuspected: false,
  });
  const set = (key, value) => setValues((current) => ({ ...current, [key]: value }));

  return (
    <form className="finding-form" onSubmit={(event) => { event.preventDefault(); onCreate(values); }}>
      <div className="form-heading"><div><p className="eyebrow">SOP §8 · VULNERABILITY TICKET</p><h3>Report a validated finding</h3></div><button type="button" className="icon-button" aria-label="Close finding form" onClick={onCancel}>×</button></div>
      <div className="form-grid">
        <label className="form-field full">Finding title<input required maxLength="200" value={values.title} onChange={(event) => set('title', event.target.value)} placeholder="[Product][Feature][Severity] Vulnerability name" /></label>
        <label className="form-field">Affected feature<select required value={values.affectedFeature} onChange={(event) => { set('affectedFeature', event.target.value); set('relatedTask', product.areas?.find((area) => area.n === event.target.value)?.j || ''); }}>{(product.areas || []).map((area) => <option key={area.n}>{area.n}</option>)}</select></label>
        <label className="form-field">Found while testing<select required value={values.foundWhile} onChange={(event) => set('foundWhile', event.target.value)}>{(product.areas || []).map((area) => <option key={area.n}>{area.n}</option>)}</select></label>
        <label className="form-field">Linked test task<input required value={values.relatedTask} onChange={(event) => set('relatedTask', event.target.value)} placeholder="SEC-123" /></label>
        <label className="form-field">Severity<select value={values.severity} onChange={(event) => set('severity', event.target.value)}>{SEVERITIES.map((severity) => <option key={severity}>{severity}</option>)}</select></label>
        {values.severity === 'Low' && <label className="form-field">Target release date<input type="date" value={values.targetRelease} onChange={(event) => set('targetRelease', event.target.value)} /></label>}
        <label className="form-field">CVSS vector<input required value={values.cvss} onChange={(event) => set('cvss', event.target.value)} placeholder="e.g. CVSS:3.1/AV:N/..." /></label>
        <label className="form-field">Test environment<input required value={values.environment} onChange={(event) => set('environment', event.target.value)} placeholder="Approved staging / production environment" /></label>
        <label className="form-field">CWE or OWASP reference<input required value={values.reference} onChange={(event) => set('reference', event.target.value)} placeholder="e.g. CWE-862 / OWASP API1:2023" /></label>
        <label className="form-field full">Description<textarea required rows="2" value={values.description} onChange={(event) => set('description', event.target.value)} /></label>
        <label className="form-field full">Steps to reproduce<textarea required rows="3" value={values.steps} onChange={(event) => set('steps', event.target.value)} /></label>
        <label className="form-field full">Impact<textarea required rows="2" value={values.impact} onChange={(event) => set('impact', event.target.value)} /></label>
        <label className="form-field full">Redacted evidence<textarea required rows="2" value={values.evidence} onChange={(event) => set('evidence', event.target.value)} placeholder="Reference securely stored evidence; do not enter credentials or customer data." /></label>
        <label className="form-field full">Recommendation<textarea required rows="2" value={values.recommendation} onChange={(event) => set('recommendation', event.target.value)} /></label>
        <label className="form-field checkbox-field full"><input type="checkbox" checked={values.late} onChange={(event) => set('late', event.target.checked)} />Late finding in an area previously tested</label>
        {values.late && <>
          <label className="form-field">Previously tested on<input type="date" required value={values.previousTest} onChange={(event) => set('previousTest', event.target.value)} /></label>
          <label className="form-field">Late-finding cause<select value={values.lateCause} onChange={(event) => set('lateCause', event.target.value)}><option>Code changed</option><option>New method</option><option>Missed check</option><option>New knowledge</option></select></label>
          <label className="form-field">Discovery method / change<input required value={values.discoveryMethod} onChange={(event) => set('discoveryMethod', event.target.value)} /></label>
        </>}
        <label className="form-field checkbox-field full"><input type="checkbox" checked={values.exploitationSuspected} onChange={(event) => set('exploitationSuspected', event.target.checked)} />Possible exploitation in production — escalate immediately as a security incident</label>
      </div>
      <p className="form-hint">Validated findings are due within 7 days (Critical), 30 days (High), or 90 days (Medium). Low findings are due next release. High/Critical validation is escalated the same day.</p>
      <div className="form-actions"><button type="button" className="button-secondary" onClick={onCancel}>Cancel</button><button type="submit" className="button-primary">Create finding report</button></div>
    </form>
  );
}

function buildReport(data, type, form, products, findings) {
  const date = form.date || todayIso();
  const reportTitle = { daily: 'Daily testing update', weekly: 'Weekly security report', monthly: 'Monthly security review', closeout: 'Baseline close-out report' }[type];
  const start = type === 'weekly' ? addDays(date, -6) : type === 'monthly' ? `${date.slice(0, 7)}-01` : date;
  const matchingEvents = data.events.filter((event) => event.date >= start && event.date <= date);
  const lines = [
    `# ${reportTitle}`,
    `Date: ${formatDate(date, { day: 'numeric', month: 'long', year: 'numeric' })}`,
    `Owner: Security Tester`,
    '',
  ];
  if (type === 'daily') {
    const product = products.find((item) => item.id === form.productId);
    lines.push(
      `Target: ${product?.name || 'Portfolio'}`,
      `Tested: ${form.tested || 'None recorded'}${product ? ` (${metricsFor(product, findings).tested}/${metricsFor(product, findings).areas} checklist areas currently tested)` : ''}`,
      `Methods: ${form.methods || 'Not recorded'}`,
      `Found: ${findings.filter((finding) => finding.found === date).length} finding(s) validated today`,
      `Notes: ${form.findingNotes || 'No additional finding notes'}`,
      `Blocked: ${form.blocked || 'None reported'}`,
      `Tomorrow: ${form.tomorrow || 'Not recorded'}`,
      '',
      'No finding means no issue was identified with the listed methods on this date; it is not proof of security.',
    );
  } else {
    const includedProducts = type === 'closeout' && form.productId
      ? products.filter((product) => product.id === form.productId)
      : products;
    const inPeriod = findings.filter((finding) => finding.found >= start && finding.found <= date);
    const resolved = findings.filter((finding) => finding.closed >= start && finding.closed <= date);
    const rejected = findings.filter((finding) => finding.status === 'Rejected');
    const completeTickets = findings.filter(isFindingComplete).length;
    const retested = findings.filter((finding) => finding.readyDate && finding.closed && finding.retestCompleted);
    const reported = findings.filter((finding) => finding.validatedAt && finding.reportedAt);
    const averageRetestDays = retested.length
      ? (retested.reduce((sum, finding) => sum + workdaysBetween(finding.readyDate, finding.retestCompleted), 0) / retested.length).toFixed(1)
      : 'No completed retests recorded';
    const averageReportHours = reported.length
      ? (reported.reduce((sum, finding) => sum + Math.max(0, (new Date(finding.reportedAt) - new Date(finding.validatedAt)) / 3600000), 0) / reported.length).toFixed(1)
      : 'No validation timestamps recorded';
    const highCritical = findings.filter((finding) => ['Critical', 'High'].includes(finding.severity) && !isClosed(finding));
    lines.push(
      `Reporting period: ${formatDate(start, { day: 'numeric', month: 'short', year: 'numeric' })} – ${formatDate(date, { day: 'numeric', month: 'short', year: 'numeric' })}`,
      '',
      '## Portfolio coverage and plan',
    );
    includedProducts.forEach((product) => {
      const metrics = metricsFor(product, findings);
      lines.push(`- ${product.name} | Tier ${product.tier} | ${product.status} | Coverage ${metrics.coverage}% (${metrics.tested}/${metrics.areas}) | Priority ${metrics.priorityCoverage}% | Plan ${metrics.planned}% / actual ${metrics.coverage}% (${metrics.behind}% behind) | Open C/H/M/L ${metrics.count.Critical}/${metrics.count.High}/${metrics.count.Medium}/${metrics.count.Low} | Health ${metrics.health} | Last tested ${product.lastTested || 'not recorded'} | Next due ${cycleRows(product).filter((row) => row.next).map((row) => `${row.title}: ${row.next}`).sort((a, b) => a.localeCompare(b))[0]?.split(': ')[1] || 'not scheduled'}`);
    });
    lines.push(
      '',
      '## Metrics',
      `Validated findings by severity: ${SEVERITIES.map((severity) => `${severity} ${inPeriod.filter((finding) => finding.severity === severity).length}`).join(' | ')}`,
      `Findings opened this period: ${inPeriod.length}`,
      `Findings closed this period: ${resolved.length}`,
      `Open Critical/High findings: ${highCritical.length}`,
      `False positive rate (Rejected / total findings): ${findings.length ? `${((rejected.length / findings.length) * 100).toFixed(1)}%` : '0%'}`,
      `Ticket completeness: ${findings.length ? `${Math.round((completeTickets / findings.length) * 100)}% (${completeTickets}/${findings.length})` : 'N/A (no findings)'}`,
      `Average time to report after validation: ${averageReportHours}`,
      `Average retest turnaround: ${averageRetestDays} working days`,
      `Retests waiting: ${findings.filter((finding) => finding.status === 'Ready for Retest').length}`,
      `Late findings: ${findings.filter((finding) => finding.late && finding.found >= start && finding.found <= date).length}`,
    );
    if (type === 'monthly') {
      lines.push('', '## Open Critical/High ageing');
      highCritical.forEach((finding) => lines.push(`- ${finding.id} ${finding.severity}: ${finding.title} — ${dateDiff(finding.found, date)} calendar days open`));
      lines.push('', '## Product register');
      includedProducts.forEach((product) => lines.push(`- ${product.name}: Tier ${product.tier}; owner ${product.owner || 'not recorded'}; data sensitivity ${product.dataSensitivity || 'not recorded'}; technology ${product.technology || 'not recorded'}; last tested ${product.lastTested || 'not recorded'}`));
      lines.push('', `## Review notes and lessons\n${form.lessons || 'Not recorded'}`, `Resource needs: ${form.resources || 'None recorded'}`);
    }
    if (type === 'closeout') {
      const product = includedProducts[0];
      if (product) {
        const metrics = metricsFor(product, findings);
        const untested = (product.areas || []).filter((area) => area.s !== 'Tested');
        lines.push('', `## Close-out: ${product.name}`, `Coverage: ${metrics.coverage}%`, `Priority coverage: ${metrics.priorityCoverage}%`, `Close-out criterion (priority 100%, overall ≥80%, report issued): ${metrics.priorityCoverage === 100 && metrics.coverage >= 80 ? 'Coverage targets met; record report date in product register.' : 'Not met — list remaining scope and seek Manager decision.'}`, 'Untested areas:');
        untested.forEach((area) => lines.push(`- ${area.n} [${area.s}] ${area.reason || 'Reason not recorded'}`));
        if (!untested.length) lines.push('- None');
        lines.push(`Recommendations: ${form.lessons || 'Not recorded'}`);
      }
    }
    lines.push('', '## Target switches, blockers and next plan');
    matchingEvents.filter((event) => event.type === 'Switch').forEach((event) => lines.push(`- ${event.date}: ${event.text}`));
    lines.push(`Blockers: ${form.blocked || 'See activity log; none additionally reported'}`, `Next period plan: ${form.tomorrow || 'Not recorded'}`, `Manager requests: ${form.manager || 'None recorded'}`);
    lines.push('', '## Activity');
    matchingEvents.forEach((event) => lines.push(`- ${event.date} · ${event.type}: ${event.text}`));
  }
  lines.push('', 'Confidential — internal use only. Never include credentials, customer data or unredacted evidence.');
  return lines.join('\n');
}

function ReportsPage({ data, products, findings, onSave }) {
  const [type, setType] = useState('daily');
  const [form, setForm] = useState({ date: todayIso(), productId: products[0]?.id || '', tested: '', methods: '', findingNotes: '', blocked: '', tomorrow: '', lessons: '', resources: '', manager: '' });
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const report = useMemo(() => buildReport(data, type, form, products, findings), [data, type, form, products, findings]);
  const download = (body, name) => {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([body], { type: 'text/markdown;charset=utf-8' }));
    link.download = name;
    link.click();
    URL.revokeObjectURL(link.href);
  };
  const save = () => {
    const item = { id: `report-${Date.now()}`, type, date: form.date, title: { daily: 'Daily update', weekly: 'Weekly report', monthly: 'Monthly review', closeout: 'Close-out report' }[type], body: report };
    onSave(item);
  };

  return (
    <div className="page-content">
      <section className="welcome-row"><div><p className="eyebrow">SECURITY OPERATIONS / SOP §10 & §17</p><h1>Security reports</h1><p className="page-subtitle">Generate daily, weekly, monthly and baseline close-out reports from the current tracker data.</p></div><Badge tone="neutral">{(data.reports || []).length} saved</Badge></section>
      <section className="panel report-builder">
        <div className="report-controls">
          <label className="form-field">Report type<select value={type} onChange={(event) => setType(event.target.value)}><option value="daily">Daily update</option><option value="weekly">Weekly report</option><option value="monthly">Monthly review</option><option value="closeout">Baseline close-out</option></select></label>
          <label className="form-field">Report date<input type="date" value={form.date} onChange={(event) => set('date', event.target.value)} /></label>
          {type === 'daily' && <label className="form-field">Target product<select value={form.productId} onChange={(event) => set('productId', event.target.value)}><option value="">Portfolio-wide</option>{products.map((product) => <option value={product.id} key={product.id}>{product.name}</option>)}</select></label>}
          {type === 'closeout' && <label className="form-field">Product<select value={form.productId} onChange={(event) => set('productId', event.target.value)}>{products.map((product) => <option value={product.id} key={product.id}>{product.name}</option>)}</select></label>}
        </div>
        {type === 'daily' && <div className="form-grid report-inputs">
          <label className="form-field">Features / checklist areas tested<input value={form.tested} onChange={(event) => set('tested', event.target.value)} placeholder="Product, feature and area counts" /></label>
          <label className="form-field">Methods used<input value={form.methods} onChange={(event) => set('methods', event.target.value)} placeholder="Methods, roles and tools" /></label>
          <label className="form-field">Finding notes<input value={form.findingNotes} onChange={(event) => set('findingNotes', event.target.value)} /></label>
          <label className="form-field">Blockers<input value={form.blocked} onChange={(event) => set('blocked', event.target.value)} /></label>
          <label className="form-field full">Tomorrow's plan<input value={form.tomorrow} onChange={(event) => set('tomorrow', event.target.value)} /></label>
        </div>}
        {type !== 'daily' && <div className="form-grid report-inputs">
          <label className="form-field full">{type === 'monthly' ? 'Lessons learned and SOP improvements' : type === 'closeout' ? 'Recommendations and residual risk' : 'Blockers and risks'}<textarea rows="2" value={form.lessons} onChange={(event) => set('lessons', event.target.value)} /></label>
          <label className="form-field">Blockers / reason<input value={form.blocked} onChange={(event) => set('blocked', event.target.value)} /></label>
          <label className="form-field">Next period plan<input value={form.tomorrow} onChange={(event) => set('tomorrow', event.target.value)} /></label>
          {type === 'monthly' && <><label className="form-field">Resource needs<input value={form.resources} onChange={(event) => set('resources', event.target.value)} /></label><label className="form-field">Requests to Manager<input value={form.manager} onChange={(event) => set('manager', event.target.value)} /></label></>}
        </div>}
        <div className="report-preview-heading"><h3>Live report preview</h3><span>Calculated from current product, finding and event data</span></div>
        <pre className="report-preview">{report}</pre>
        <div className="form-actions"><button className="button-secondary" onClick={() => download(report, `vapt-${type}-${form.date}.md`)}>Download report</button><button className="button-primary" onClick={save}>Save report to activity</button></div>
      </section>
      {!!data.reports?.length && <section className="panel list-panel"><div className="panel-heading"><div><p className="eyebrow">REPORT ARCHIVE</p><h2>Saved reports</h2></div></div><div className="saved-reports">{[...data.reports].reverse().map((item) => <div className="saved-report" key={item.id}><span><strong>{item.title}</strong><small>{formatDate(item.date, { day: 'numeric', month: 'long', year: 'numeric' })} · {item.type}</small></span><button className="text-button" onClick={() => download(item.body, `vapt-${item.type}-${item.date}.md`)}>Download →</button></div>)}</div></section>}
    </div>
  );
}

function SettingsPage({ data, onSaveEmail }) {
  const [email, setEmail] = useState(data.config.retestEmail || '');
  const save = (event) => {
    event.preventDefault();
    onSaveEmail(email.trim());
  };
  return (
    <div className="page-content">
      <section className="welcome-row"><div><p className="eyebrow">SECURITY OPERATIONS / CONFIGURATION</p><h1>Workflow settings</h1><p className="page-subtitle">Configure retest notifications and review the SOP rules applied by this tracker.</p></div></section>
      <form className="panel settings-card" onSubmit={save}><p className="eyebrow">RETEST ROUTING</p><h2>Security Tester email</h2><p className="panel-description">When a developer clicks “Request retest”, the finding is marked Ready for Retest and a prefilled email draft opens to this address.</p><label className="form-field">Notification email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="security-tester@company.com" /></label><div className="form-actions"><button className="button-primary" type="submit">Save email setting</button></div><p className="form-hint">This browser-only app opens the user's email client; it cannot send email in the background. Records are stored in this browser and are not shared across users or devices.</p></form>
      <section className="panel settings-card"><p className="eyebrow">APPLICATION SECURITY TESTING · SOP VERSION 1.0</p><h2>Workflow rules currently applied</h2><ul className="sop-list"><li>Test-area coverage = Tested tasks ÷ all tasks. Priority coverage uses only high-risk tasks.</li><li>Baseline completion requires 100% priority coverage, at least 80% overall, and a recorded close-out date.</li><li>Fix targets: Critical 7 days; High 30 days; Medium 90 days; Low by the next release.</li><li>Critical/High findings escalate the same day. Retest target: 2 working days after the fix is ready.</li><li>Tier cycles: regression monthly / quarterly / every 6 months; auth quarterly / every 6 months / yearly; dependency weekly / weekly / monthly; configuration quarterly / every 6 months / yearly.</li><li>Health: Red for critical overdue, &gt;20 points behind, overdue cycle or missed baseline; Amber for high overdue, up to 20 points behind, paused, or stalled 3 working days.</li><li>Areas are time-boxed: change approach after 1 day in testing; after 2 days, move to another area and record a reason.</li><li>Daily, weekly, monthly and close-out reports are generated from live records and archived locally.</li></ul></section>
    </div>
  );
}

function Dashboard({ data, products, findings, onSelect, onNavigate, onAddFinding }) {
  const allMetrics = products.map((product) => metricsFor(product, findings));
  const visibleProductIds = new Set(products.map((product) => product.id));
  const visibleFindings = findings.filter((finding) => visibleProductIds.has(finding.product));
  const totalAreas = allMetrics.reduce((sum, metrics) => sum + metrics.areas, 0);
  const testedAreas = allMetrics.reduce((sum, metrics) => sum + metrics.tested, 0);
  const totalOpen = allMetrics.reduce((sum, metrics) => sum + metrics.open.length, 0);
  const critical = visibleFindings.filter((finding) => finding.severity === 'Critical' && !isClosed(finding)).length;
  const high = visibleFindings.filter((finding) => finding.severity === 'High' && !isClosed(finding)).length;
  const retests = visibleFindings.filter((finding) => finding.status === 'Ready for Retest').length;
  const overdueRetests = visibleFindings.filter((finding) => finding.status === 'Ready for Retest' && finding.retestDue && finding.retestDue < todayIso()).length;
  const upcoming = products.flatMap((product) => cycleRows(product)
    .filter((row) => row.next)
    .map((row) => ({ ...row, product })))
    .sort((a, b) => a.next.localeCompare(b.next))
    .slice(0, 5);
  const recentEvents = [...data.events].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);

  return (
    <div className="page-content">
      <section className="welcome-row">
        <div><p className="eyebrow">SECURITY OPERATIONS / OVERVIEW</p><h1>Vulnerability assessment</h1><p className="page-subtitle">A live view of testing progress, remediation and product risk.</p></div>
        <div className="last-updated"><span className="live-dot" /> Sample data snapshot · {formatDate(data.generated, { day: 'numeric', month: 'short', year: 'numeric' })}</div>
      </section>
      <div className="sample-notice"><span>ⓘ</span><div><strong>Sample environment</strong><p>All products, findings and events shown here are example data. Replace these records before using this dashboard for operational decisions.</p></div></div>
      <section className="metric-grid" aria-label="Security summary">
        <MetricCard label="Testing coverage" value={`${totalAreas ? Math.round((testedAreas / totalAreas) * 100) : 0}%`} note={`${testedAreas} of ${totalAreas} test areas`} icon="◉" tone="blue" />
        <MetricCard label="Open findings" value={totalOpen} note={`${critical} critical · ${high} high`} icon="⌕" tone="orange" />
        <MetricCard label="Retests waiting" value={retests} note={`${overdueRetests} over the 2-working-day target`} icon="↻" tone="purple" />
        <MetricCard label="Products monitored" value={products.length} note={`${products.filter((product) => metricsFor(product, findings).health === 'Red').length} require urgent attention`} icon="▣" tone="green" />
      </section>
      <section className="content-grid">
        <article className="panel chart-panel">
          <div className="panel-heading"><div><p className="eyebrow">FINDINGS</p><h2>Open vulnerabilities</h2></div><button className="text-button" onClick={() => onNavigate('findings')}>View all <span>→</span></button></div>
          <p className="panel-description">Open issues by product, grouped by severity.</p>
          <FindingsChart products={products} findings={findings} />
        </article>
        <article className="panel chart-panel">
          <div className="panel-heading"><div><p className="eyebrow">COVERAGE</p><h2>Testing progress</h2></div><Badge tone="neutral">Weekly</Badge></div>
          <p className="panel-description">Average coverage from weekly snapshots.</p>
          <CoverageChart products={products} history={data.history || []} />
        </article>
      </section>
      <section className="panel table-panel">
        <div className="panel-heading"><div><p className="eyebrow">PORTFOLIO</p><h2>Product security status</h2></div><div className="panel-heading-actions"><span className="table-count">{products.length} products</span><button className="button-secondary compact" onClick={() => onAddFinding()}>Manage findings</button></div></div>
        <ProductTable products={products} findings={findings} onSelect={onSelect} />
      </section>
      <section className="content-grid bottom-grid">
        <article className="panel list-panel">
          <div className="panel-heading"><div><p className="eyebrow">ACTION REQUIRED</p><h2>Priority findings</h2></div><button className="text-button" onClick={() => onNavigate('findings')}>All findings →</button></div>
          <div className="priority-list">
            {visibleFindings.filter((finding) => !isClosed(finding) && ['Critical', 'High'].includes(finding.severity)).sort((a, b) => SEVERITIES.indexOf(a.severity) - SEVERITIES.indexOf(b.severity)).slice(0, 4).map((finding) => {
              const product = data.products[finding.product];
              return <button className="priority-item" key={finding.id} onClick={() => product && onSelect(finding.product)}>
                <span className="severity-indicator" style={{ background: SEVERITY_COLORS[finding.severity] }} />
                <span className="priority-copy"><strong>{finding.title}</strong><small>{finding.id} · {product?.name || finding.product}</small></span>
                <Badge tone={finding.severity.toLowerCase()}>{finding.severity}</Badge>
              </button>;
            })}
            {!visibleFindings.some((finding) => !isClosed(finding) && ['Critical', 'High'].includes(finding.severity)) && <p className="empty-state">No open critical or high findings.</p>}
          </div>
        </article>
        <article className="panel list-panel">
          <div className="panel-heading"><div><p className="eyebrow">SCHEDULE</p><h2>Next test cycles</h2></div><span className="table-count">Upcoming</span></div>
          <div className="schedule-list">
            {upcoming.map((row) => <div className="schedule-item" key={`${row.product.id}-${row.key}`}>
              <span className="schedule-date"><strong>{formatDate(row.next, { day: 'numeric' })}</strong><small>{formatDate(row.next, { month: 'short' })}</small></span>
              <span className="schedule-copy"><strong>{row.title}</strong><small>{row.product.name} · {row.frequency}</small></span>
            </div>)}
            {!upcoming.length && <p className="empty-state">Add cycle dates to schedule future reviews.</p>}
          </div>
        </article>
      </section>
      <section className="panel list-panel">
        <div className="panel-heading"><div><p className="eyebrow">RETEST · SOP §12</p><h2>Ready for retest</h2></div><button className="text-button" onClick={() => onNavigate('findings')}>Open finding register →</button></div>
        <div className="priority-list">
          {visibleFindings.filter((finding) => finding.status === 'Ready for Retest').sort((a, b) => (a.retestDue || '').localeCompare(b.retestDue || '')).slice(0, 5).map((finding) => <div className="priority-item retest-queue-item" key={finding.id}>
            <span className="severity-indicator" style={{ background: SEVERITY_COLORS[finding.severity] }} />
            <span className="priority-copy"><strong>{finding.id} · {finding.title}</strong><small>{data.products[finding.product]?.name || finding.product} · Ready {formatDate(finding.readyDate)} · target {formatDate(finding.retestDue)}</small></span>
            <button className="button-secondary compact" onClick={() => onSelect(finding.product)}>Open</button>
          </div>)}
          {!visibleFindings.some((finding) => finding.status === 'Ready for Retest') && <p className="empty-state">No fixes are waiting for retest.</p>}
        </div>
      </section>
      <section className="panel list-panel event-panel">
        <div className="panel-heading"><div><p className="eyebrow">AUDIT TRAIL</p><h2>Recent activity</h2></div><button className="text-button" onClick={() => onNavigate('activity')}>Activity log →</button></div>
        <div className="event-list">
          {recentEvents.map((event, index) => <div className="event-item" key={`${event.date}-${event.type}-${index}`}>
            <span className={`event-marker event-${event.type.toLowerCase().replace(/[^a-z]/g, '')}`} />
            <span className="event-copy"><strong>{event.type}</strong><span>{event.text}</span></span>
            <time>{formatDate(event.date)}</time>
          </div>)}
        </div>
      </section>
    </div>
  );
}

function ProductDetail({
  product, findings, data, onBack, onAreaChange, onAreaFieldChange, onFindingStatusChange,
  onProductChange, onCycleDateChange, onAddFinding, onRequestRetest, onDownloadFinding,
}) {
  const metrics = metricsFor(product, findings);
  const rows = cycleRows(product);
  const [findingFilter, setFindingFilter] = useState('All');
  const [showFindingForm, setShowFindingForm] = useState(false);
  const visibleFindings = metrics.findings.filter((finding) => findingFilter === 'All' || (findingFilter === 'Open' ? !isClosed(finding) : finding.status === findingFilter));
  const baselineReady = metrics.priorityCoverage === 100
    && metrics.coverage >= 80
    && !!product.closeout
    && metrics.findings.every(isFindingComplete)
    && (product.areas || []).every((area) => area.s === 'Tested' || String(area.reason || area.notes || '').trim());
  const retestMailto = (finding) => {
    const body = `Retest requested for ${finding.id}\nProduct: ${product.name || product.id}\nFinding: ${finding.title}\nSeverity: ${finding.severity}\nFix ready: ${finding.readyDate}\nPlease verify the fix and record the retest outcome.`;
    return `mailto:${encodeURIComponent(data.config.retestEmail || '')}?subject=${encodeURIComponent(`Retest requested: ${finding.id} (${finding.severity})`)}&body=${encodeURIComponent(body)}`;
  };

  return (
    <div className="page-content detail-page">
      <button className="back-button" onClick={onBack}>← <span>All products</span></button>
      <section className="detail-heading">
        <div className="detail-title">
          <span className="product-mark large" style={{ background: productColor(product.id) }} />
          <div><p className="eyebrow">PRODUCT PROFILE · TIER {product.tier}</p><h1>{product.name}</h1><p className="page-subtitle">{product.domain || 'Domain not specified'} <span>·</span> {product.owner || 'Owner not specified'}</p></div>
        </div>
        <HealthBadge health={metrics.health} />
      </section>
      <section className="metric-grid detail-metrics">
        <MetricCard label="Overall coverage" value={`${metrics.coverage}%`} note={`${metrics.tested}/${metrics.areas} areas tested`} icon="◉" tone="blue" />
        <MetricCard label="High-risk coverage" value={`${metrics.priorityCoverage}%`} note={`${metrics.priorityTested}/${metrics.highRisk} priority areas`} icon="⬡" tone="purple" />
        <MetricCard label="Open findings" value={metrics.open.length} note={`${metrics.count.Critical} critical · ${metrics.count.High} high`} icon="⌕" tone="orange" />
        <MetricCard label="Risk score" value={metrics.risk.toFixed(1)} note={`Tier ${product.tier} weighted`} icon="△" tone="green" />
      </section>
      <section className="detail-columns">
        <article className="panel detail-section">
          <div className="panel-heading"><div><p className="eyebrow">TEST PLAN · SOP §7</p><h2>Coverage by test area</h2></div><span className="table-count">{metrics.tested} / {metrics.areas} tested</span></div>
          <div className="area-list">
            {(product.areas || []).map((area, index) => <div className="area-row" key={`${area.n}-${index}`}>
              <span className={`area-check ${area.s === 'Tested' ? 'done' : area.s === 'In Testing' ? 'in-progress' : ''}`}>{area.s === 'Tested' ? '✓' : area.s === 'In Testing' ? '·' : ''}</span>
              <span className="area-name">{area.n}{area.hr && <small>High risk</small>}{area.s === 'Tested' && area.result === 'No finding' && <small className="no-finding-label">No finding</small>}{area.s === 'In Testing' && area.startedAt && workdaysBetween(area.startedAt, todayIso()) >= 1 && <small className="timebox-warning">{workdaysBetween(area.startedAt, todayIso()) >= 2 ? 'Move to another feature' : 'Change method today'}</small>}</span>
              <select aria-label={`Status for ${area.n}`} value={area.s} onChange={(event) => onAreaChange(product.id, index, event.target.value)}>
                {AREA_STATUSES.map((status) => <option key={status}>{status}</option>)}
              </select>
              <details className="area-record"><summary aria-label={`Record test details for ${area.n}`}>Details</summary><div className="area-record-fields">
                <label>Method<input value={area.method || ''} onChange={(event) => onAreaFieldChange(product.id, index, 'method', event.target.value)} placeholder="Testing method" /></label>
                <label>Date<input type="date" value={area.s === 'Tested' ? area.testedAt || '' : area.startedAt || ''} onChange={(event) => onAreaFieldChange(product.id, index, area.s === 'Tested' ? 'testedAt' : 'startedAt', event.target.value)} /></label>
                <label>Jira task<input value={area.j || ''} onChange={(event) => onAreaFieldChange(product.id, index, 'j', event.target.value)} placeholder="SEC-123" /></label>
                <label>Notes / blocker reason<input value={area.notes || area.reason || ''} onChange={(event) => onAreaFieldChange(product.id, index, 'notes', event.target.value)} placeholder="Reason when blocked or deferred" /></label>
                <label>Result<select value={area.result || ''} onChange={(event) => onAreaFieldChange(product.id, index, 'result', event.target.value)}><option value="">Select result</option><option>No finding</option><option>Finding raised</option></select></label>
              </div></details>
            </div>)}
          </div>
        </article>
        <article className="panel detail-section cycle-section">
          <div className="panel-heading"><div><p className="eyebrow">SOP SCHEDULE · §11–13</p><h2>Test cycle plan</h2></div></div>
          <div className="cycle-list">
            {rows.map((row) => <div className="cycle-item" key={row.key}>
              <span className="cycle-icon">{row.key === 'dep' ? '⌘' : row.key === 'baseline' ? '◉' : '↻'}</span>
              <span className="cycle-copy"><strong>{row.title}</strong><small>{row.frequency}{row.last ? ` · Last ${formatDate(row.last)}` : ' · No date recorded'}</small></span>
              <span className={`cycle-due ${row.next && row.next < todayIso() ? 'overdue-text' : ''}`}>{row.eventBased ? <span className="event-based-label">Release based</span> : row.next ? formatDate(row.next, { day: 'numeric', month: 'short', year: 'numeric' }) : 'Not scheduled'}</span>
              <div className="cycle-actions"><label>{row.eventBased ? 'Last review' : 'Last done'}<input aria-label={`Last done: ${row.title}`} type="date" value={product.done?.[row.source] || (row.source === 'baseline' ? product.closeout || '' : '')} onChange={(event) => onCycleDateChange(product.id, row.source, event.target.value)} /></label><button onClick={() => onCycleDateChange(product.id, row.source, todayIso())}>{row.eventBased ? 'Mark reviewed' : 'Mark done'}</button></div>
            </div>)}
          </div>
          <p className="cycle-footnote">Tier {product.tier} intervals are calculated from each activity's last-completed date using the current SOP starter targets.</p>
        </article>
      </section>
      <section className="panel product-plan">
        <div className="panel-heading"><div><p className="eyebrow">PRODUCT REGISTER · SOP §6–7, §13</p><h2>Engagement and product status</h2></div><HealthBadge health={metrics.health} /></div>
        <div className="form-grid register-fields">
          <label className="form-field">Baseline status<select value={product.status || 'Not started'} onChange={(event) => onProductChange(product.id, 'status', event.target.value)}>{PRODUCT_STATUSES.map((status) => <option key={status}>{status}</option>)}</select></label>
          <label className="form-field">Risk tier<select value={product.tier || 2} onChange={(event) => onProductChange(product.id, 'tier', Number(event.target.value))}><option value="1">Tier 1 — highest</option><option value="2">Tier 2</option><option value="3">Tier 3</option></select></label>
          <label className="form-field">Baseline start<input type="date" value={product.baselineStart || ''} onChange={(event) => onProductChange(product.id, 'baselineStart', event.target.value)} /></label>
          <label className="form-field">Estimated working days<input type="number" min="1" max="90" value={product.estDays || 7} onChange={(event) => onProductChange(product.id, 'estDays', Number(event.target.value))} /></label>
          <label className="form-field">Close-out report date<input type="date" value={product.closeout || ''} onChange={(event) => onProductChange(product.id, 'closeout', event.target.value)} /></label>
          <label className="form-field">Last tested<input type="date" value={product.lastTested || ''} onChange={(event) => onProductChange(product.id, 'lastTested', event.target.value)} /></label>
          <label className="form-field">Technology stack<input value={product.technology || ''} onChange={(event) => onProductChange(product.id, 'technology', event.target.value)} placeholder="Web / API / mobile / cloud" /></label>
          <label className="form-field">Data sensitivity<input value={product.dataSensitivity || ''} onChange={(event) => onProductChange(product.id, 'dataSensitivity', event.target.value)} placeholder="Customer / payments / internal" /></label>
          <label className="form-field full">Manager-approved reason / handover for status changes<input value={product.switchReason || ''} onChange={(event) => onProductChange(product.id, 'switchReason', event.target.value)} placeholder="Required before changing baseline status; include handover and coverage at switch" /></label>
        </div>
        {product.status === 'In progress' && <div className="plan-status"><strong>Plan vs actual:</strong> {metrics.elapsedWorkdays} / {product.estDays || 7} working days elapsed · planned {metrics.planned}% · actual {metrics.coverage}% · {metrics.behind}% behind.</div>}
        {product.status === 'In progress' && metrics.priorityCoverage === 100 && metrics.coverage >= 80 && !product.closeout && <div className="plan-status attention-status"><strong>Baseline nearly complete.</strong> Enter the close-out report date before changing status to Baseline complete.</div>}
        {product.status === 'Baseline complete' && !baselineReady && <div className="plan-status attention-status"><strong>Baseline completion criteria not met.</strong> Requires 100% priority coverage, at least 80% overall, and a close-out report date.</div>}
        {product.status === 'Paused' && <label className="resume-field">Manager-approved resume date<input type="date" value={product.resumeOn || ''} onChange={(event) => onProductChange(product.id, 'resumeOn', event.target.value)} /></label>}
        <div className="panel-heading finding-heading"><div><p className="eyebrow">FINDINGS · SOP §8</p><h2>Vulnerability register</h2></div><button className="button-primary compact" onClick={() => setShowFindingForm((open) => !open)}>{showFindingForm ? 'Cancel' : '+ Report finding'}</button></div>
        {showFindingForm && <FindingForm product={product} onCancel={() => setShowFindingForm(false)} onCreate={(values) => { onAddFinding(product.id, values); setShowFindingForm(false); }} />}
        <div className="finding-heading-inner">
          <label className="select-label">Show <select value={findingFilter} onChange={(event) => setFindingFilter(event.target.value)}><option>All</option><option>Open</option>{FINDING_STATUSES.filter((status) => !['Open', 'Triaged', 'In Fix', 'Ready for Retest'].includes(status)).map((status) => <option key={status}>{status}</option>)}</select></label>
          <span className="form-hint">Validated Critical/High findings require same-day escalation. Exit statuses require a reason.</span>
        </div>
        <div className="table-scroll"><table className="findings-table">
          <thead><tr><th>Issue</th><th>Finding</th><th>Severity</th><th>Status</th><th>Found</th><th>Fix deadline</th><th>Retest / report</th></tr></thead>
          <tbody>{visibleFindings.map((finding) => <tr key={finding.id}>
            <td><span className="issue-key">{finding.id}</span>{finding.late && <small className="late-label">Late finding</small>}</td>
            <td className="finding-title">{finding.title}</td>
            <td><Badge tone={finding.severity.toLowerCase()}>{finding.severity}</Badge></td>
            <td><FindingStatusControl finding={finding} onChange={onFindingStatusChange} />{finding.statusReason && <small className="late-label">Reason recorded</small>}</td>
            <td>{formatDate(finding.found)}</td><td>{formatDate(finding.due)}</td>
            <td><div className="finding-actions">{finding.status === 'In Fix' && <button className="button-secondary compact" onClick={() => onRequestRetest(finding.id, retestMailto(finding))}>Request retest</button>}<button className="text-button" onClick={() => onDownloadFinding(finding)}>Report</button></div>{finding.readyDate && <small className="retest-note">Ready {formatDate(finding.readyDate)} · due {formatDate(finding.retestDue)}</small>}</td>
          </tr>)}
          {!visibleFindings.length && <tr><td className="empty-cell" colSpan="7">No findings in this view.</td></tr>}</tbody>
        </table></div>
      </section>
      <section className="panel detail-section">
        <div className="panel-heading"><div><p className="eyebrow">ACTIVITY</p><h2>Product history</h2></div></div>
        <div className="event-list">
          {[...data.events].filter((event) => event.product === product.id).sort((a, b) => b.date.localeCompare(a.date)).map((event, index) => <div className="event-item" key={`${event.date}-${index}`}><span className="event-marker" /><span className="event-copy"><strong>{event.type}</strong><span>{event.text}</span></span><time>{formatDate(event.date)}</time></div>)}
        </div>
      </section>
    </div>
  );
}

function FindingsPage({ findings, products, onSelect, onFindingStatusChange, onRequestRetest, onDownloadFinding, onAddFinding, data }) {
  const [formProductId, setFormProductId] = useState('');
  const [showForm, setShowForm] = useState(false);
  const selectedProduct = products.find((product) => product.id === formProductId);
  return (
    <div className="page-content">
      <section className="welcome-row"><div><p className="eyebrow">SECURITY OPERATIONS / TRACKING</p><h1>All findings</h1><p className="page-subtitle">Track remediation, SLA dates and retest requests. Exit statuses require a reason.</p></div><div className="report-controls"><Badge tone="neutral">{findings.filter((finding) => !isClosed(finding)).length} open</Badge><select className="quick-product-select" aria-label="Select product for finding report" value={formProductId} onChange={(event) => setFormProductId(event.target.value)}><option value="">Select product…</option>{products.map((product) => <option value={product.id} key={product.id}>{product.name}</option>)}</select><button className="button-primary compact" disabled={!selectedProduct} onClick={() => setShowForm(true)}>+ Report finding</button></div></section>
      {showForm && selectedProduct && <FindingForm product={selectedProduct} onCancel={() => setShowForm(false)} onCreate={(values) => { onAddFinding(selectedProduct.id, values); setShowForm(false); }} />}
      <section className="panel table-panel"><div className="table-scroll"><table className="findings-table">
        <thead><tr><th>Issue</th><th>Finding</th><th>Product</th><th>Severity</th><th>Status</th><th>Found</th><th>Fix deadline</th><th>Action</th></tr></thead>
        <tbody>{findings.map((finding) => {
          const product = products.find((item) => item.id === finding.product);
          const retestMailto = `mailto:${encodeURIComponent(data.config.retestEmail || '')}?subject=${encodeURIComponent(`Retest requested: ${finding.id} (${finding.severity})`)}&body=${encodeURIComponent(`Retest requested for ${finding.id}\nProduct: ${product?.name || finding.product}\nFinding: ${finding.title}\nSeverity: ${finding.severity}\nFix ready: ${todayIso()}\nPlease verify the fix and record the retest outcome.`)}`;
          return <tr key={finding.id}>
            <td><span className="issue-key">{finding.id}</span></td><td className="finding-title">{finding.title}</td>
            <td><button className="inline-link" onClick={() => product && onSelect(product.id)}>{product?.name || finding.product}</button></td>
            <td><Badge tone={finding.severity.toLowerCase()}>{finding.severity}</Badge></td>
            <td><FindingStatusControl finding={finding} onChange={onFindingStatusChange} /></td>
            <td>{formatDate(finding.found)}</td><td>{formatDate(finding.due)}</td>
            <td><div className="finding-actions">{finding.status === 'In Fix' && <button className="button-secondary compact" onClick={() => onRequestRetest(finding.id, retestMailto)}>Request retest</button>}<button className="text-button" onClick={() => onDownloadFinding(finding)}>Report</button></div></td>
          </tr>;
        })}</tbody>
      </table></div></section>
    </div>
  );
}

function ActivityPage({ events, products, onSelect }) {
  const nameById = Object.fromEntries(products.map((product) => [product.id, product.name]));
  return (
    <div className="page-content">
      <section className="welcome-row"><div><p className="eyebrow">SECURITY OPERATIONS / AUDIT TRAIL</p><h1>Activity log</h1><p className="page-subtitle">Recent assessment events across the product portfolio.</p></div><Badge tone="neutral">{events.length} events</Badge></section>
      <section className="panel activity-page-list">{[...events].sort((a, b) => b.date.localeCompare(a.date)).map((event, index) => <div className="activity-row" key={`${event.date}-${index}`}>
        <time>{formatDate(event.date, { day: 'numeric', month: 'short', year: 'numeric' })}</time><span className="event-marker" /><div><Badge tone="neutral">{event.type}</Badge><p>{event.text}</p>{event.product && <button className="inline-link" onClick={() => onSelect(event.product)}>{nameById[event.product] || event.product} →</button>}</div>
      </div>)}</section>
    </div>
  );
}

export default function App() {
  const [data, setData] = useState(readSavedData);
  const [activePage, setActivePage] = useState('overview');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [search, setSearch] = useState('');
  const [tier, setTier] = useState('all');
  const [toast, setToast] = useState('');

  useEffect(() => {
    persistData(data);
  }, [data]);

  useEffect(() => {
    const routeFromHash = () => {
      const match = /^#p-(.+)$/.exec(window.location.hash);
      setSelectedProductId(match?.[1] || '');
    };
    window.addEventListener('hashchange', routeFromHash);
    routeFromHash();
    return () => window.removeEventListener('hashchange', routeFromHash);
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(''), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const products = useMemo(() => PRODUCT_ORDER
    .filter((id) => data.products[id])
    .map((id) => ({ id, ...data.products[id] }))
    .concat(Object.entries(data.products)
      .filter(([id]) => !PRODUCT_ORDER.includes(id))
      .map(([id, product]) => ({ id, ...product })))
    .filter((product) => (!tier || tier === 'all' || String(product.tier) === tier)
      && `${product.name} ${product.domain || ''} ${product.id}`.toLowerCase().includes(search.trim().toLowerCase())), [data.products, search, tier]);
  const findings = useMemo(() => Object.entries(data.findings)
    .map(([id, finding]) => ({ id, ...finding }))
    .sort((a, b) => {
      const severityOrder = SEVERITIES.indexOf(a.severity) - SEVERITIES.indexOf(b.severity);
      return severityOrder || b.found.localeCompare(a.found);
    }), [data.findings]);
  const selectedProduct = selectedProductId ? data.products[selectedProductId] && { id: selectedProductId, ...data.products[selectedProductId] } : null;

  const selectProduct = (id) => {
    setActivePage('overview');
    window.location.hash = `p-${id}`;
    setSelectedProductId(id);
  };
  const goBack = () => {
    window.history.pushState(null, '', `${window.location.pathname}${window.location.search}`);
    setSelectedProductId('');
  };
  const updateArea = (productId, index, status) => {
    const now = todayIso();
    const currentArea = data.products[productId]?.areas?.[index];
    if (status === 'Tested' && currentArea?.s !== 'Tested') {
      if (!currentArea?.method?.trim() || !['No finding', 'Finding raised'].includes(currentArea?.result)) {
        setToast('Open this area’s Details and record its method and result before marking it Tested.');
        return;
      }
    }
    if (status === 'Blocked' && currentArea?.s !== 'Blocked' && !currentArea?.reason?.trim() && !currentArea?.notes?.trim()) {
      setToast('Open this area’s Details and record a blocker reason before setting it to Blocked.');
      return;
    }
    if (status !== 'Blocked' && currentArea?.s === 'Blocked' && !currentArea?.reason?.trim() && !currentArea?.notes?.trim()) {
      setToast('Record why the blocker was cleared before changing the status.');
      return;
    }
    setData((current) => {
      const product = current.products[productId];
      const oldArea = product.areas[index];
      const areas = product.areas.map((area, areaIndex) => areaIndex === index
        ? {
          ...area,
          s: status,
          ...(status === 'In Testing' && !area.startedAt ? { startedAt: now } : {}),
          ...(status === 'Tested' ? { testedAt: now } : {}),
        }
        : area);
      const updatedProduct = {
        ...product,
        areas,
        lastTested: status === 'Tested' ? now : product.lastTested,
      };
      const events = status !== oldArea.s
        ? [{ date: now, type: status === 'Blocked' ? 'Blocker' : 'Progress', product: productId, text: `${oldArea.n}: ${oldArea.s} → ${status}${status === 'Tested' ? ` (${areas[index].result}; method: ${areas[index].method})` : ''}${status === 'Blocked' ? `; reason: ${areas[index].reason || areas[index].notes}` : ''}.` }, ...current.events]
        : current.events;
      const productsState = { ...current.products, [productId]: updatedProduct };
      const snapshot = coverageSnapshot(Object.entries(productsState), now);
      const history = [...current.history.filter((item) => item.date !== now), snapshot].sort((a, b) => a.date.localeCompare(b.date));
      return { ...current, products: productsState, events, history };
    });
    setToast('Test area status saved locally.');
  };
  const updateAreaField = (productId, index, field, value) => {
    setData((current) => {
      const product = current.products[productId];
      const areas = product.areas.map((area, areaIndex) => areaIndex === index ? { ...area, [field]: value } : area);
      return {
        ...current,
        products: {
          ...current.products,
          [productId]: { ...product, areas, ...(field === 'testedAt' && value ? { lastTested: value } : {}) },
        },
      };
    });
  };
  const updateProduct = (productId, field, value) => {
    const currentProduct = data.products[productId];
    if (field === 'status' && ['Baseline complete', 'Continuous'].includes(value)) {
      const product = { id: productId, ...currentProduct };
      const metrics = metricsFor(product, findings);
      const untestedAreasHaveReasons = (product.areas || []).every((area) => area.s === 'Tested' || String(area.reason || area.notes || '').trim());
      const complete = metrics.priorityCoverage === 100
        && metrics.coverage >= 80
        && !!product.closeout
        && untestedAreasHaveReasons
        && metrics.findings.every(isFindingComplete);
      if (!complete) {
        setToast(`${value} requires 100% priority coverage, at least 80% overall, a close-out date, complete finding tickets, and reasons for all untested areas.`);
        return;
      }
    }
    const changeReason = field === 'status' ? (currentProduct.switchReason || '').trim() : '';
    if (field === 'status' && value !== currentProduct.status && !changeReason) {
      setToast('Enter the Manager-approved reason / handover before changing the product status.');
      return;
    }
    setData((current) => {
      const product = current.products[productId];
      const updated = { ...product, [field]: value, ...(field === 'status' ? { switchReason: '' } : {}) };
      const events = field === 'status' && value !== product.status
        ? [{ date: todayIso(), type: 'Switch', product: productId, text: `Baseline status changed from ${product.status} to ${value}; coverage at change: ${metricsFor({ id: productId, ...product }, Object.entries(current.findings).map(([id, finding]) => ({ id, ...finding }))).coverage}%. Manager-approved reason / handover: ${changeReason.trim()}` }, ...current.events]
        : current.events;
      return { ...current, products: { ...current.products, [productId]: updated }, events };
    });
    if (field !== 'switchReason') setToast(field === 'status' ? 'Product status saved and logged.' : 'Product register updated.');
  };
  const updateCycleDate = (productId, cycle, value) => {
    setData((current) => {
      const product = current.products[productId];
      const updated = {
        ...product,
        done: { ...(product.done || {}), [cycle]: value },
        ...(cycle === 'baseline' ? { closeout: value } : {}),
        ...(value ? { lastTested: value } : {}),
      };
      const events = value
        ? [{ date: todayIso(), type: 'Progress', product: productId, text: `${CYCLE_RULES.find((row) => row.source === cycle)?.title || cycle} recorded as completed on ${value}.` }, ...current.events]
        : current.events;
      return { ...current, products: { ...current.products, [productId]: updated }, events };
    });
    setToast('Cycle date updated; next due date recalculated.');
  };
  const updateFinding = (findingId, status, statusReason = '') => {
    const existing = data.findings[findingId];
    if (!existing || existing.status === status) return;
    if (EXIT_STATUSES.includes(status) && !statusReason.trim()) {
      setToast(`${status} needs a recorded reason. Status was not changed.`);
      return;
    }
    const now = todayIso();
    const updatedFinding = {
      ...existing,
      status,
      ...(status === 'Ready for Retest' ? { readyDate: now, retestDue: addWorkdays(now, 2), retestRequestedAt: now } : {}),
      ...(status === 'Closed' ? { closed: now, ...(existing.status === 'Ready for Retest' ? { retestCompleted: now } : {}) } : {}),
      ...(EXIT_STATUSES.includes(status) ? { statusReason: statusReason.trim() } : {}),
      ...(status === 'Open' || status === 'Triaged' || status === 'In Fix' ? { closed: '', statusReason: '' } : {}),
    };
    setData((current) => ({
      ...current,
      findings: { ...current.findings, [findingId]: updatedFinding },
      events: [{ date: now, type: status === 'Ready for Retest' ? 'Retest' : 'Finding', product: existing.product, text: `${findingId} status changed from ${existing.status} to ${status}${statusReason ? `; reason: ${statusReason}` : ''}.` }, ...current.events],
    }));
    setToast(`${findingId} status saved and activity logged.`);
  };
  const addFinding = (productId, values) => {
    const product = data.products[productId];
    const id = nextFindingId(findings, data.config.project || 'SEC');
    const found = todayIso();
    const reportedAt = new Date().toISOString();
    const due = values.severity === 'Low' ? values.targetRelease || '' : addDays(found, SEVERITY_DAYS[values.severity]);
    const updatedAreas = (product.areas || []).map((area) => values.late && area.n === values.affectedFeature
      ? {
        ...area,
        s: 'In Testing',
        startedAt: found,
        method: [area.method, `Late-finding follow-up: ${values.discoveryMethod}`].filter(Boolean).join('\n'),
        notes: `Reopened after ${id}; cause: ${values.lateCause}; previously tested ${values.previousTest}. Check similar features and products.`,
      }
      : area);
    const finding = {
      ...values,
      product: productId,
      title: `[${product.name}][${values.affectedFeature}][${values.severity}] ${values.title.trim()}`,
      severity: values.severity,
      status: 'Triaged',
      found,
      validatedAt: reportedAt,
      reportedAt,
      due,
      readyDate: '',
      closed: '',
      ...(values.late ? { previousTest: values.previousTest, discoveryMethod: values.discoveryMethod, lateCause: values.lateCause } : {}),
    };
    setData((current) => ({
      ...current,
      findings: { ...current.findings, [id]: finding },
      products: { ...current.products, [productId]: { ...product, areas: updatedAreas, lastTested: found } },
      events: [
        { date: found, type: 'Finding', product: productId, text: `${values.severity} finding ${id} validated and reported for ${values.affectedFeature}.${values.late ? ' Late finding; check similar areas and products.' : ''}` },
        ...(values.late ? [{ date: found, type: 'Progress', product: productId, text: `Reopened ${values.affectedFeature} after late finding ${id}; cause ${values.lateCause}; previous test ${values.previousTest}; added method: ${values.discoveryMethod}. Retest similar features and products.` }] : []),
        ...(values.severity === 'Critical' || values.severity === 'High' ? [{ date: found, type: 'Escalation', product: productId, text: `${values.severity} finding ${id} escalated to the development lead and Manager on the validation date.` }] : []),
        ...(values.exploitationSuspected ? [{ date: found, type: 'Incident', product: productId, text: `Possible production exploitation suspected for ${id}; notify the Manager and development lead immediately and follow the incident process.` }] : []),
        ...current.events,
      ],
      history: [...current.history.filter((item) => item.date !== found), coverageSnapshot(Object.entries({
        ...current.products,
        [productId]: { ...product, areas: updatedAreas, lastTested: found },
      }), found)].sort((a, b) => a.date.localeCompare(b.date)),
    }));
    setToast(`${id} created. ${values.exploitationSuspected ? 'Production incident escalation logged.' : values.severity === 'Critical' || values.severity === 'High' ? 'Same-day escalation recorded.' : ''}`);
  };
  const requestRetest = (findingId, mailto) => {
    const existing = data.findings[findingId];
    if (!existing || existing.status !== 'In Fix') return;
    const now = todayIso();
    setData((current) => ({
      ...current,
      findings: {
        ...current.findings,
        [findingId]: { ...existing, status: 'Ready for Retest', readyDate: now, retestDue: addWorkdays(now, 2), retestRequestedAt: now },
      },
      events: [{ date: now, type: 'Retest', product: existing.product, text: `Retest requested for ${findingId}; response target ${addWorkdays(now, 2)} (2 working days).` }, ...current.events],
    }));
    if (data.config.retestEmail) {
      window.location.href = mailto;
      setToast(`Retest request recorded for ${findingId}; your email app is opening.`);
    } else {
      setToast(`Retest request recorded for ${findingId}. Add the tester email under Workflow settings to open the email draft.`);
    }
  };
  const saveEmail = (email) => {
    setData((current) => ({ ...current, config: { ...current.config, retestEmail: email } }));
    setToast('Retest notification email saved in this browser.');
  };
  const saveReport = (report) => {
    let closeoutProduct = null;
    if (report.type === 'closeout') {
      const match = /## Close-out: ([^\n]+)/.exec(report.body);
      closeoutProduct = Object.entries(data.products).find(([, item]) => item.name === match?.[1]) || null;
      if (closeoutProduct) {
        const [productId, productData] = closeoutProduct;
        const metrics = metricsFor({ id: productId, ...productData }, findings);
        const hasUntestedReasons = (productData.areas || []).every((area) => area.s === 'Tested' || String(area.reason || area.notes || '').trim());
        const canIssue = metrics.coverage >= 80 && metrics.priorityCoverage === 100
          && hasUntestedReasons && metrics.findings.every(isFindingComplete);
        if (!canIssue) closeoutProduct = null;
      }
    }
    setData((current) => ({
      ...current,
      reports: [...(current.reports || []), report],
      ...(closeoutProduct ? {
        products: {
          ...current.products,
          [closeoutProduct[0]]: { ...current.products[closeoutProduct[0]], closeout: report.date, done: { ...(current.products[closeoutProduct[0]].done || {}), baseline: report.date } },
        },
      } : {}),
      events: [{ date: report.date, type: 'Report', product: '', text: `${report.title} saved for ${report.date}.` }, ...current.events],
      ...(report.type === 'weekly' ? {
        history: [...current.history.filter((item) => item.date !== report.date), coverageSnapshot(Object.entries(current.products), report.date)].sort((a, b) => a.date.localeCompare(b.date)),
      } : {}),
    }));
    setToast('Report saved to the local activity archive.');
  };
  const downloadFinding = (finding) => {
    const product = data.products[finding.product];
    const url = URL.createObjectURL(new Blob([buildFindingReport(finding, product)], { type: 'text/markdown;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `finding-${finding.id}.md`;
    link.click();
    URL.revokeObjectURL(url);
  };
  const exportData = () => {
    const file = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'vapt-dashboard-data.json';
    link.click();
    URL.revokeObjectURL(url);
  };
  const resetData = () => {
    if (!window.confirm('Reset all local edits and restore the bundled sample data?')) return;
    localStorage.removeItem(STORAGE_KEY);
    setData(sampleData);
    setToast('Bundled sample data restored.');
  };

  const navItems = [
    { id: 'overview', label: 'Overview', icon: '▦' },
    { id: 'findings', label: 'Findings', icon: '⌕' },
    { id: 'reports', label: 'Reports', icon: '▤' },
    { id: 'activity', label: 'Activity log', icon: '◷' },
    { id: 'settings', label: 'Settings', icon: '⚙' },
  ];
  const content = selectedProduct
    ? <ProductDetail product={selectedProduct} findings={findings} data={data} onBack={goBack} onAreaChange={updateArea} onAreaFieldChange={updateAreaField} onFindingStatusChange={updateFinding} onProductChange={updateProduct} onCycleDateChange={updateCycleDate} onAddFinding={addFinding} onRequestRetest={requestRetest} onDownloadFinding={downloadFinding} />
    : activePage === 'findings'
      ? <FindingsPage findings={findings} products={Object.entries(data.products).map(([id, product]) => ({ id, ...product }))} onSelect={selectProduct} onFindingStatusChange={updateFinding} onRequestRetest={requestRetest} onDownloadFinding={downloadFinding} onAddFinding={addFinding} data={data} />
      : activePage === 'reports'
        ? <ReportsPage data={data} products={Object.entries(data.products).map(([id, product]) => ({ id, ...product }))} findings={findings} onSave={saveReport} />
        : activePage === 'settings'
          ? <SettingsPage data={data} onSaveEmail={saveEmail} />
          : activePage === 'activity'
        ? <ActivityPage events={data.events} products={Object.entries(data.products).map(([id, product]) => ({ id, ...product }))} onSelect={selectProduct} />
          : <Dashboard data={data} products={products} findings={findings} onSelect={selectProduct} onNavigate={setActivePage} onAddFinding={() => setActivePage('findings')} />;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#" onClick={(event) => { event.preventDefault(); goBack(); setActivePage('overview'); }}>
          <span className="brand-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.8 20 6v5.3c0 5-3.4 8.5-8 10.1-4.6-1.6-8-5.1-8-10.1V6z" /><path d="m8.6 12 2.2 2.2 4.7-5" /></svg></span>
          <span><strong>Sentinel</strong><small>SECURITY CONSOLE</small></span>
        </a>
        <div className="workspace-label">WORKSPACE</div>
        <div className="workspace-switch"><span className="workspace-avatar">VA</span><span><strong>Vulnerability Assessments</strong><small>Internal workspace</small></span><span className="switch-arrow">⌄</span></div>
        <div className="nav-label">MENU</div>
        <nav className="main-nav" aria-label="Main navigation">
          {navItems.map((item) => <button key={item.id} className={(!selectedProduct && activePage === item.id) ? 'active' : ''} onClick={() => { setSelectedProductId(''); window.history.pushState(null, '', `${window.location.pathname}${window.location.search}`); setActivePage(item.id); }}><span>{item.icon}</span>{item.label}{item.id === 'findings' && <small>{findings.filter((finding) => !isClosed(finding)).length}</small>}</button>)}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note"><span>ⓘ</span><p><strong>Sample data only</strong><br />Do not use as a live security report.</p></div>
          <div className="user-profile"><span className="user-avatar">ST</span><span><strong>Security team</strong><small>Dashboard editor</small></span><button aria-label="Export data" title="Export data" onClick={exportData}>•••</button></div>
        </div>
      </aside>
      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumb"><span>Workspace</span><i>/</i><strong>{selectedProduct?.name || navItems.find((item) => item.id === activePage)?.label || 'Overview'}</strong></div>
          <div className="top-actions">
            {!selectedProduct && activePage === 'overview' && <div className="toolbar-filter"><span>⌕</span><input aria-label="Search products" placeholder="Search products..." value={search} onChange={(event) => setSearch(event.target.value)} /><select aria-label="Filter by tier" value={tier} onChange={(event) => setTier(event.target.value)}><option value="all">All tiers</option><option value="1">Tier 1</option><option value="2">Tier 2</option><option value="3">Tier 3</option></select></div>}
            <button className="icon-button" aria-label="Export sample data" title="Export JSON" onClick={exportData}>⇩</button>
            <button className="avatar-button" aria-label="Reset sample data" title="Reset sample data" onClick={resetData}>ST</button>
          </div>
        </header>
        {content}
        <footer className="app-footer"><span>Sentinel Security Console</span><span>Confidential · Internal use only</span><span>Sample data · {new Date().getFullYear()}</span></footer>
      </main>
      {toast && <div className="toast-message" role="status">{toast}</div>}
    </div>
  );
}
