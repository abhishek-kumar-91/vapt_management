import type { ReactNode } from "react"
import clsx from "clsx"

import styles from "./styles.module.css"

const CLOSEOUT = 80

/**
 * Static copy of the console's close-out meter (components/closeout-meter.tsx):
 * Tested / In testing / Blocked / To do with a tick at the SOP's 80% line.
 */
export function CloseoutMeter({
  tested,
  inTesting = 0,
  blocked = 0,
  todo = 0,
  label,
}: {
  tested: number
  inTesting?: number
  blocked?: number
  todo?: number
  label?: string
}) {
  const total = tested + inTesting + blocked + todo
  const coverage = total ? Math.round((tested / total) * 100) : 0
  const pct = (n: number) => `${total ? (n / total) * 100 : 0}%`
  const passed = coverage >= CLOSEOUT
  return (
    <figure className={styles.meterFigure}>
      <div className={styles.meterHead}>
        <span className={styles.meterValue}>{coverage}%</span>
        <span className={styles.meterLabel}>
          {label ?? "coverage"} · {tested} of {total} areas tested
        </span>
      </div>
      <div
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={coverage}
        aria-label={`Coverage ${coverage}%: ${tested} tested, ${inTesting} in testing, ${blocked} blocked, ${todo} to do. Close-out line at ${CLOSEOUT}%.`}
        className={styles.meter}
      >
        <div className={styles.track}>
          {tested > 0 && <span className={styles.tested} style={{ width: pct(tested) }} />}
          {inTesting > 0 && <span className={styles.inTesting} style={{ width: pct(inTesting) }} />}
          {blocked > 0 && <span className={styles.blocked} style={{ width: pct(blocked) }} />}
        </div>
        <span className={clsx(styles.tick, passed && styles.tickPassed)} style={{ left: `${CLOSEOUT}%` }} />
      </div>
      <figcaption className={styles.legend}>
        <span><i className={styles.tested} />Tested</span>
        <span><i className={styles.inTesting} />In testing</span>
        <span><i className={styles.blocked} />Blocked</span>
        <span><i className={styles.todo} />To do</span>
        <span><i className={clsx(styles.tickKey, passed && styles.tickPassed)} />{CLOSEOUT}% close-out line</span>
      </figcaption>
    </figure>
  )
}

export type Tone =
  | "critical" | "high" | "medium" | "low"
  | "success" | "warning" | "paused" | "primary" | "neutral"

const TONE_BY_WORD: Record<string, Tone> = {
  Critical: "critical", High: "high", Medium: "medium", Low: "low",
  Green: "success", Amber: "warning", Red: "critical", Paused: "paused", "Not started": "neutral",
  Open: "neutral", Triaged: "primary", "In Fix": "warning", "Ready for Retest": "paused",
  Closed: "success", Rejected: "neutral", "Risk Accepted": "neutral", "Won't Fix": "neutral",
}

/** Tinted status badge; colour is always paired with its word. */
export function Badge({ children, tone, dot }: { children: string; tone?: Tone; dot?: boolean }) {
  const resolved = tone ?? TONE_BY_WORD[children] ?? "neutral"
  return (
    <span className={clsx(styles.badge, styles[`tone-${resolved}`])}>
      {dot && <i className={styles.badgeDot} />}
      {children}
    </span>
  )
}

/**
 * A colour token: swatch, name, app token and light value. `preview` is the docs
 * variable that mirrors the token, so the chip follows the docs theme.
 */
export function Swatch({ name, token, value, preview, note }: { name: string; token: string; value: string; preview?: string; note?: ReactNode }) {
  return (
    <div className={styles.swatch}>
      <span className={styles.chip} style={{ background: preview ? `var(--${preview}, ${value})` : value }} />
      <div className={styles.swatchText}>
        <strong>{name}</strong>
        <code>{token}</code>
        <span className={styles.swatchValue}>{value}</span>
        {note && <span className={styles.swatchNote}>{note}</span>}
      </div>
    </div>
  )
}

export function SwatchGrid({ children }: { children: ReactNode }) {
  return <div className={styles.swatchGrid}>{children}</div>
}

/** File path chip that points at the source a page documents. */
export function Source({ path, children }: { path: string; children?: ReactNode }) {
  return (
    <p className={styles.source}>
      <span className={styles.sourceLabel}>Source</span>
      <code>{path}</code>
      {children && <span className={styles.sourceNote}>{children}</span>}
    </p>
  )
}
