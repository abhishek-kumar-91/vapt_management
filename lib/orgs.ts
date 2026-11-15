/** Company profile options and rules shared by onboarding forms, settings and the server. */

export const INDUSTRIES = [
  "Fintech and payments",
  "E-commerce and retail",
  "SaaS and software",
  "Healthcare",
  "Education",
  "Logistics",
  "Media and entertainment",
  "Government and public sector",
  "Other",
] as const

export const COMPANY_SIZES = [
  "1–10",
  "11–50",
  "51–200",
  "201–1,000",
  "1,000+",
] as const

export const DATA_SENSITIVITY = ["Low", "Medium", "High", "Regulated"] as const

/** Slugs that would collide with app routes or look official. */
export const RESERVED_SLUGS = new Set([
  "admin", "api", "app", "auth", "dashboard", "help", "invite", "login", "logout", "new",
  "o", "onboarding", "pentest-scout", "pentestscout", "settings", "signup", "support",
  "system", "verify", "www",
])

export const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/
export const PREFIX_PATTERN = /^[A-Z][A-Z0-9]{1,9}$/

/** Default finding-key prefix from a slug: "stores-of-india" → "SOI", "acme" → "ACME". */
export function prefixFor(slug: string) {
  const parts = slug.split("-").filter(Boolean)
  const raw =
    parts.length > 1
      ? parts.map((p) => p[0]).join("")
      : (parts[0] ?? "").slice(0, 6)
  const clean = raw.toUpperCase().replace(/[^A-Z0-9]/g, "")
  const prefixed = /^[A-Z]/.test(clean) ? clean : `C${clean}`
  return prefixed.length >= 2 ? prefixed.slice(0, 10) : `${prefixed}X`
}

export const ORG_STATUS_LABELS = {
  draft: "Setting up",
  pending_review: "Waiting for review",
  active: "Active",
  rejected: "Not approved",
  suspended: "Suspended",
  closed: "Closed",
} as const
