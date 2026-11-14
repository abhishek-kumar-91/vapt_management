"use client"

import * as React from "react"
import {
  CheckIcon,
  DatabaseIcon,
  DownloadIcon,
  MailIcon,
  PaletteIcon,
  RotateCcwIcon,
  ScrollTextIcon,
  ShieldCheckIcon,
} from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { AppearancePicker } from "@/components/settings/appearance-picker"
import {
  SettingsLayout,
  SettingsRow,
  SettingsSection,
  type SettingsNavItem,
} from "@/components/settings/settings-layout"
import { ThemePicker } from "@/components/settings/theme-picker"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Field, FieldError } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { SOP_RULES } from "@/lib/sop"
import { useDashboard } from "@/lib/store"
import { EMAIL } from "@/lib/users"

/** Every settings area, in page order. Add a section here and render it below. */
const SECTIONS: SettingsNavItem[] = [
  { id: "appearance", label: "Appearance", icon: PaletteIcon },
  { id: "security", label: "Security", icon: ShieldCheckIcon },
  { id: "retest-routing", label: "Retest routing", icon: MailIcon },
  { id: "data", label: "Data and storage", icon: DatabaseIcon },
  { id: "workflow-rules", label: "Workflow rules", icon: ScrollTextIcon },
]

export default function SettingsPage() {
  const { data } = useDashboard()
  return (
    <div className="grid gap-8">
      <PageHeader
        title="Settings"
        description="How this console looks, where retest requests go, and how your data is kept."
      />
      <SettingsLayout items={SECTIONS}>
        <SettingsSection
          id="appearance"
          title="Appearance"
          description="Saved in this browser only. Other people keep their own choice."
          scope="This browser"
        >
          <SettingsRow
            label="Theme"
            description="System follows your device’s light or dark setting. Press D anywhere to toggle."
          >
            <ThemePicker />
          </SettingsRow>
          <SettingsRow
            label="Navigation frame"
            description="Dark sidebar keeps a dark frame around light content, whatever the theme."
          >
            <AppearancePicker />
          </SettingsRow>
        </SettingsSection>

        <SettingsSection
          id="security"
          title="Security"
          description="How you sign in to this console."
          scope="Your account"
        >
          <SettingsRow
            label="Two-factor authentication"
            description="Ask for a code from an authenticator app after your password, so a leaked password alone can’t open your account."
          >
            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant="outline"
                disabled
                aria-describedby="two-factor-status"
              >
                Set up two-factor
              </Button>
              <span
                id="two-factor-status"
                className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary"
              >
                Coming soon
              </span>
            </div>
          </SettingsRow>
        </SettingsSection>

        {/* Remount when the stored address changes (save, reset) so the field never shows stale text. */}
        <RetestRouting key={data.config.retestEmail ?? ""} />
        <DataAndStorage />

        <SettingsSection
          id="workflow-rules"
          title="Workflow rules"
          description="Application Security Testing SOP v1.0, as this console enforces it."
          scope="Read only"
        >
          <ul className="grid gap-3 py-5">
            {SOP_RULES.map((rule) => (
              <li key={rule} className="flex gap-3 text-sm text-pretty">
                <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                  <CheckIcon className="size-3" strokeWidth={3} aria-hidden />
                </span>
                {rule}
              </li>
            ))}
          </ul>
        </SettingsSection>
      </SettingsLayout>
    </div>
  )
}

function RetestRouting() {
  const { data, actions } = useDashboard()
  const saved = data.config.retestEmail || ""
  const [email, setEmail] = React.useState(saved)
  const [error, setError] = React.useState("")
  const value = email.trim()
  const dirty = value !== saved

  const save = (event: React.FormEvent) => {
    event.preventDefault()
    if (value && !EMAIL.test(value)) {
      setError("Enter a full email address, like tester@company.com.")
      return
    }
    setError("")
    actions.saveEmail(value)
  }

  return (
    <form onSubmit={save} noValidate>
      <SettingsSection
        id="retest-routing"
        title="Retest routing"
        description="When a developer requests a retest, the finding moves to Ready for Retest and an email draft opens to this address."
        scope="This browser"
        footer={
          <>
            <span
              aria-live="polite"
              className="mr-auto text-xs text-muted-foreground"
            >
              {dirty ? "Unsaved change" : saved ? "Saved" : "No address yet"}
            </span>
            {dirty && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setEmail(saved)
                  setError("")
                }}
              >
                Discard
              </Button>
            )}
            <Button type="submit" disabled={!dirty}>
              Save address
            </Button>
          </>
        }
      >
        <SettingsRow
          label="Security Tester email"
          htmlFor="retest-email"
          description="Your email app opens a prefilled draft; nothing is sent automatically. Leave empty to skip the draft."
        >
          <Field data-invalid={!!error || undefined} className="max-w-sm">
            <Input
              id="retest-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                if (error) setError("")
              }}
              placeholder="security-tester@company.com"
              aria-invalid={!!error || undefined}
              aria-describedby={error ? "retest-email-error" : undefined}
            />
            {error && <FieldError id="retest-email-error">{error}</FieldError>}
          </Field>
        </SettingsRow>
      </SettingsSection>
    </form>
  )
}

function DataAndStorage() {
  const { data, products, findings, actions } = useDashboard()
  const counts = [
    `${products.length} products`,
    `${findings.length} findings`,
    `${data.reports?.length ?? 0} saved reports`,
    `${data.events.length} activity events`,
  ].join(" · ")

  return (
    <SettingsSection
      id="data"
      title="Data and storage"
      description="Records live in this browser’s local storage. They aren’t shared with other users or devices."
      scope="This browser"
    >
      <SettingsRow
        label="Stored here"
        description="The bundled starting data plus any edits made in this browser."
      >
        <p className="text-sm tabular-nums">{counts}</p>
      </SettingsRow>
      <SettingsRow
        label="Export data"
        description="Download everything as JSON to keep a copy or move it to another browser."
      >
        <Button variant="outline" onClick={actions.exportData}>
          <DownloadIcon data-icon="inline-start" />
          Export JSON
        </Button>
      </SettingsRow>
      <SettingsRow
        label="Reset local data"
        description="Discards every local edit and restores the bundled starting data. This can’t be undone."
      >
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive">
              <RotateCcwIcon data-icon="inline-start" />
              Reset data
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Reset local data?</AlertDialogTitle>
              <AlertDialogDescription>
                This discards every local edit in this browser (test areas,
                findings, cycle dates and saved reports) and restores the
                bundled starting data. Export JSON first if you want to keep a
                copy.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={actions.resetData}
              >
                Reset data
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SettingsRow>
    </SettingsSection>
  )
}
