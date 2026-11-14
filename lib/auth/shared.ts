/** Auth constants and types safe to import anywhere: proxy, client components, server. */
import type { Role } from "./roles"

/** `__Host-` pins the cookie to this exact host over HTTPS; plain name in dev (http). */
export const SESSION_COOKIE =
  process.env.NODE_ENV === "production" ? "__Host-session" : "session"

/** Absolute session lifetime; the server also expires sessions after 12 idle hours. */
export const SESSION_MAX_AGE_S = 7 * 24 * 60 * 60

/** What the browser is allowed to know about the signed-in user. */
export interface SessionUser {
  id: string
  name: string
  email: string
  role: Role
  productIds: string[]
}

/** Only same-site dashboard paths; anything else (//evil.com, /\evil, https:) falls back. */
export function safeNext(value: unknown): string {
  return typeof value === "string" &&
    /^\/dashboard(?:[/?#]|$)/.test(value) &&
    !/[\\]|\/\//.test(value)
    ? value
    : "/dashboard"
}

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
