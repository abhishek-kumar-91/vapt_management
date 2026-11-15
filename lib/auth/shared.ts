/** Auth constants and types safe to import anywhere: proxy, client components, server. */
import type { Role } from "./roles"

/** The company the console is showing. */
export interface OrgSummary {
  id: string
  slug: string
  name: string
  status: "draft" | "pending_review" | "active" | "rejected" | "suspended" | "closed"
}

/** `__Host-` pins the cookie to this exact host over HTTPS; plain name in dev (http). */
export const SESSION_COOKIE =
  process.env.NODE_ENV === "production" ? "__Host-session" : "session"

/** Absolute session lifetime; the server also expires sessions after 12 idle hours. */
export const SESSION_MAX_AGE_S = 7 * 24 * 60 * 60

/** What the browser is allowed to know about the signed-in user, in the current company. */
export interface SessionUser {
  id: string
  name: string
  email: string
  /** SUPER_ADMIN for Pentest Scout admins, otherwise their role in this company. */
  role: Role
  /** Products they can view or edit (Owners and Super Admins see all regardless). */
  productIds: string[]
  /** Products they can edit. */
  editProductIds: string[]
  org: OrgSummary | null
  /** Companies they can switch to (active memberships). */
  orgs: { slug: string; name: string }[]
}

/**
 * Only same-site app paths; anything else (//evil.com, /\evil, https:) falls back to /dashboard,
 * which sends each person to their own home.
 */
export function safeNext(value: unknown): string {
  return typeof value === "string" &&
    /^\/(?:dashboard|o|admin|onboarding|invite)(?:[/?#]|$)/.test(value) &&
    !/[\\]|\/\//.test(value)
    ? value
    : "/dashboard"
}

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
