import { day } from "@/components/admin/bits"
import { PageHeader, SectionHeading } from "@/components/page-header"
import { emailTransport } from "@/lib/email/send"
import { listAdmins } from "@/server/admin"

export const metadata = { title: "Settings" }

export default async function AdminSettingsPage() {
  const admins = await listAdmins()
  const transport = emailTransport()
  return (
    <div className="grid gap-8">
      <PageHeader title="Settings" description="Platform settings. These are set in code and the environment, not here, so they can’t be changed by a compromised session." />
      <section className="grid gap-3">
        <SectionHeading title="Super Admins" description="Created only from the terminal: pnpm user:create --email … --name …" />
        <ul className="grid divide-y rounded-3xl ring-1 ring-foreground/10">
          {admins.map((a) => (
            <li key={a.email} className="flex flex-wrap items-baseline gap-x-3 px-5 py-3 text-sm">
              <span className="font-medium">{a.name}</span>
              <span className="text-muted-foreground">{a.email}</span>
              <span className="ml-auto text-muted-foreground">Last sign-in {day(a.lastLoginAt)}</span>
            </li>
          ))}
        </ul>
      </section>
      <section className="grid gap-3">
        <SectionHeading title="Email" />
        <p className="rounded-3xl px-5 py-4 text-sm ring-1 ring-foreground/10">
          {transport === "outbox"
            ? "Not connected. Emails wait in the Outbox and you send their links yourself. Set EMAIL_TRANSPORT once a provider is connected (phase 10)."
            : "Development mode: emails are queued in the Outbox and printed to the server console, and links appear on screen where they’re created."}
        </p>
      </section>
    </div>
  )
}
