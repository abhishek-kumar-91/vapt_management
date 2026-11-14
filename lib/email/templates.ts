/**
 * Email templates: plain text first (what most security teams read), with a minimal HTML copy.
 * Each takes the facts it needs and returns subject + bodies. No tracking, no images.
 */

export interface Rendered {
  subject: string
  text: string
  html: string
}

const escape = (value: string) =>
  value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

/** Paragraphs plus an optional action link. */
function render(subject: string, paragraphs: string[], action?: { label: string; url: string }): Rendered {
  const text = [
    ...paragraphs,
    ...(action ? [`${action.label}: ${action.url}`] : []),
    "— Pentest Scout",
  ].join("\n\n")
  const html = [
    ...paragraphs.map((p) => `<p>${escape(p)}</p>`),
    ...(action
      ? [`<p><a href="${escape(action.url)}">${escape(action.label)}</a></p>`]
      : []),
    "<p>— Pentest Scout</p>",
  ].join("\n")
  return { subject, text, html }
}

export const TEMPLATES = {
  verify_email: (d: { name: string; link: string }) =>
    render(
      "Confirm your email for Pentest Scout",
      [
        `Hi ${d.name},`,
        "Confirm this is your email address to finish setting up your company on Pentest Scout. The link works once and expires in 24 hours.",
        "If you didn’t sign up, you can ignore this email.",
      ],
      { label: "Confirm email", url: d.link }
    ),

  account_exists: (d: { name: string; loginUrl: string; resetUrl: string }) =>
    render(
      "You already have a Pentest Scout account",
      [
        `Hi ${d.name},`,
        "Someone tried to sign up with this email, but it already has an account. Sign in instead, or reset your password if you’ve forgotten it.",
        `Reset your password: ${d.resetUrl}`,
        "If this wasn’t you, you can ignore this email.",
      ],
      { label: "Sign in", url: d.loginUrl }
    ),

  org_invite: (d: {
    inviter: string
    orgName: string
    role: string
    link: string
  }) =>
    render(
      `${d.inviter} invited you to ${d.orgName} on Pentest Scout`,
      [
        `${d.inviter} invited you to join ${d.orgName} as ${d.role}.`,
        "The link works once and expires in 72 hours.",
      ],
      { label: "Accept the invite", url: d.link }
    ),

  password_reset: (d: { name: string; link: string }) =>
    render(
      "Reset your Pentest Scout password",
      [
        `Hi ${d.name},`,
        "Use this link to choose a new password. It works once and expires in 24 hours. Setting a new password signs you out everywhere else.",
        "If you didn’t ask for this, you can ignore this email; your password stays the same.",
      ],
      { label: "Choose a new password", url: d.link }
    ),

  org_submitted: (d: { orgName: string; ownerName: string; link: string }) =>
    render(
      `New company waiting for review: ${d.orgName}`,
      [`${d.ownerName} submitted ${d.orgName} for review.`],
      { label: "Review it", url: d.link }
    ),

  org_approved: (d: { orgName: string; link: string }) =>
    render(
      `${d.orgName} is approved`,
      [
        `${d.orgName} is approved and ready on Pentest Scout. Invite your team and start tracking your products.`,
      ],
      { label: "Open Pentest Scout", url: d.link }
    ),

  org_rejected: (d: { orgName: string; note: string; link: string }) =>
    render(
      `${d.orgName} wasn’t approved`,
      [
        `We couldn’t approve ${d.orgName} on Pentest Scout.`,
        `Reason: ${d.note}`,
        "You can update the details and submit it again.",
      ],
      { label: "Update and resubmit", url: d.link }
    ),

  org_changes_requested: (d: { orgName: string; note: string; link: string }) =>
    render(
      `Changes needed for ${d.orgName}`,
      [
        `Before we approve ${d.orgName}, please change the following:`,
        d.note,
      ],
      { label: "Make the changes", url: d.link }
    ),

  testing_request_new: (d: { orgName: string; productName: string; link: string }) =>
    render(
      `Testing request: ${d.productName} (${d.orgName})`,
      [`${d.orgName} asked Pentest Scout to test ${d.productName}.`],
      { label: "Review the request", url: d.link }
    ),

  testing_request_update: (d: {
    orgName: string
    productName: string
    status: string
    note?: string
    link: string
  }) =>
    render(
      `Testing request for ${d.productName}: ${d.status}`,
      [
        `Your request for Pentest Scout to test ${d.productName} is now ${d.status.toLowerCase()}.`,
        ...(d.note ? [d.note] : []),
      ],
      { label: "View the request", url: d.link }
    ),
} satisfies Record<string, (data: never) => Rendered>

export type Template = keyof typeof TEMPLATES
export type TemplateData<T extends Template> = Parameters<(typeof TEMPLATES)[T]>[0]
