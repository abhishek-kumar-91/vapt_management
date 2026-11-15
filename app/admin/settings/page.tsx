import { day } from "@/components/admin/bits"
import { PageHeader } from "@/components/page-header"
import { AppearancePicker } from "@/components/settings/appearance-picker"
import { AdminSettingsLayout } from "@/components/admin/admin-settings-layout"
import { SettingsRow, SettingsSection } from "@/components/settings/settings-layout"
import { ThemePicker } from "@/components/settings/theme-picker"
import { emailTransport } from "@/lib/email/send"
import { listAdmins } from "@/server/admin"

export const metadata = { title: "Settings" }

export default async function AdminSettingsPage() {
  const admins = await listAdmins()
  const transport = emailTransport()
  return (
    <div className="grid gap-8">
      <PageHeader
        title="Settings"
        description="How the admin console looks. Platform settings live in code and the environment, so a stolen session can’t change them."
      />
      <AdminSettingsLayout>
        <SettingsSection
          id="appearance"
          title="Appearance"
          description="Saved in this browser only."
          scope="This browser"
        >
          <SettingsRow label="Theme" description="System follows your device’s light or dark setting. Press D anywhere to toggle.">
            <ThemePicker />
          </SettingsRow>
          <SettingsRow label="Navigation frame" description="Dark sidebar keeps a dark frame around light content, whatever the theme.">
            <AppearancePicker />
          </SettingsRow>
        </SettingsSection>

        <SettingsSection
          id="admins"
          title="Super Admins"
          description="Created only from the terminal with pnpm user:create, so no one can grant this from the app."
          scope="Read only"
        >
          {admins.map((a) => (
            <SettingsRow key={a.email} label={a.name} description={a.email}>
              <p className="text-sm text-muted-foreground tabular">Last sign-in {day(a.lastLoginAt)}</p>
            </SettingsRow>
          ))}
        </SettingsSection>

        <SettingsSection id="email" title="Email" description="How the platform’s emails leave the app." scope="Environment">
          <SettingsRow
            label={transport === "outbox" ? "Not connected" : "Development"}
            description={
              transport === "outbox"
                ? "Emails wait in the Outbox and you send their links yourself. Connecting a provider is phase 10."
                : "Emails are queued in the Outbox, printed to the server console, and their links appear on screen where they’re created."
            }
          >
            <code className="font-mono text-xs">EMAIL_TRANSPORT={transport}</code>
          </SettingsRow>
        </SettingsSection>
      </AdminSettingsLayout>
    </div>
  )
}
