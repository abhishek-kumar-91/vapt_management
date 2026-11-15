import "server-only"

import { and, eq, inArray } from "drizzle-orm"
import { headers } from "next/headers"

import { emailOutbox } from "@/db/schema"
import type { Tx } from "@/lib/auth/audit"

import { TEMPLATES, type Template, type TemplateData } from "./templates"

/**
 * How email leaves the app (docs/database-architecture.md §7). Every email is queued in
 * email_outbox first; nothing sends directly.
 *   log     queue + print to the server console + show links on screen (development default)
 *   outbox  queue only; Super Admins copy links from Admin → Outbox (production default)
 * A provider transport (phase 10) will send pending rows from a cron job.
 */
export function emailTransport(): "log" | "outbox" {
  const configured = process.env.EMAIL_TRANSPORT
  if (configured === "log" || configured === "outbox") return configured
  return process.env.NODE_ENV === "production" ? "outbox" : "log"
}

/** True when links may be shown on screen to the person who triggered them (development only). */
export const showLinksOnScreen = () =>
  emailTransport() === "log" && process.env.NODE_ENV !== "production"

/** Absolute URL for a path, from APP_URL or the current request. */
export async function appUrl(path: string) {
  const configured = process.env.APP_URL?.replace(/\/$/, "")
  if (configured) return `${configured}${path}`
  const h = await headers()
  const origin =
    h.get("origin") ??
    `${h.get("x-forwarded-proto") ?? "https"}://${h.get("x-forwarded-host") ?? h.get("host")}`
  return `${origin}${path}`
}

/** Queue one email in the caller's transaction, so it exists only if the change commits. */
export async function sendEmail<T extends Template>(
  tx: Tx,
  message: {
    to: string
    template: T
    data: TemplateData<T>
    orgId?: string | null
    userId?: string | null
    /** The action link inside, kept for Admin → Outbox. */
    link?: string
    /** The one-time token behind `link`, so the link is blanked once it's used. */
    tokenId?: string
    expiresAt?: Date
  }
) {
  const rendered = (TEMPLATES[message.template] as (d: TemplateData<T>) => {
    subject: string
    text: string
    html: string
  })(message.data)
  const [row] = await tx
    .insert(emailOutbox)
    .values({
      toEmail: message.to,
      template: message.template,
      subject: rendered.subject,
      bodyText: rendered.text,
      bodyHtml: rendered.html,
      link: message.link ?? null,
      tokenId: message.tokenId ?? null,
      orgId: message.orgId ?? null,
      userId: message.userId ?? null,
      expiresAt: message.expiresAt ?? null,
    })
    .returning({ id: emailOutbox.id })
  if (emailTransport() === "log")
    console.info(
      `[email:${message.template}] to ${message.to} · ${rendered.subject}${message.link ? `\n  ${message.link}` : ""}`
    )
  return row.id
}

/**
 * A token was used or replaced: the emails carrying it no longer hold a working link, so blank
 * the link and bodies and cancel any still waiting to go out.
 */
export async function retireTokenEmails(tx: Tx, tokenIds: string[]) {
  if (!tokenIds.length) return
  await tx
    .update(emailOutbox)
    .set({ link: null, bodyText: null, bodyHtml: null })
    .where(inArray(emailOutbox.tokenId, tokenIds))
  await tx
    .update(emailOutbox)
    .set({ status: "cancelled" })
    .where(
      and(
        inArray(emailOutbox.tokenId, tokenIds),
        eq(emailOutbox.status, "pending")
      )
    )
}
