"use client"

import * as React from "react"
import {
  CheckIcon,
  DatabaseIcon,
  DownloadIcon,
  Building2Icon,
  PaletteIcon,
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
import { Button } from "@/components/ui/button"
import { SOP_RULES } from "@/lib/sop"
import { useDashboard } from "@/lib/store"
import { saveOrgSettingsAction } from "@/app/o/[org]/actions"
import { useCan, useCurrentUser } from "@/components/current-user"
import { SubmitButton, useFormAction } from "@/components/forms/action-form"
import { Field, FieldError } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

/** Every settings area, in page order. Add a section here and render it below. */
const SECTIONS: SettingsNavItem[] = [
  { id: "appearance", label: "Appearance", icon: PaletteIcon },
  { id: "security", label: "Security", icon: ShieldCheckIcon },
  { id: "organization", label: "Company", icon: Building2Icon },
  { id: "data", label: "Data", icon: DatabaseIcon },
  { id: "workflow-rules", label: "Workflow rules", icon: ScrollTextIcon },
]

export default function SettingsPage() {
  return (
    <div className="grid gap-8">
      <PageHeader
        title="Settings"
        description="How this console looks, your company’s shared settings, and your data."
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

        <OrganizationSettings />
        <DataSection />

        <SettingsSection
          id="workflow-rules"
          title="Workflow rules"
          description="Application Security Testing SOP v1.0, as this console enforces it."
          scope="Read only"
        >
          <ul className="grid max-w-[62ch] gap-3 py-5 text-sm">
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

const COMPANY_ROWS = [
  {
    name: "name",
    label: "Company name",
    description: "Shown in the sidebar and on reports.",
    maxLength: 80,
  },
  {
    name: "findingPrefix",
    label: "Finding key prefix",
    description: "Findings are numbered PREFIX-1, PREFIX-2… Locked once the first finding exists.",
    maxLength: 10,
  },
  {
    name: "retestEmail",
    label: "Retest email",
    description: "Retest requests open an email draft to this address. Leave empty to skip the draft.",
    type: "email",
    placeholder: "security-tester@company.com",
  },
  {
    name: "jiraBaseUrl",
    label: "Jira base URL",
    description: "Jira keys on test areas and findings link here.",
    type: "url",
    placeholder: "https://company.atlassian.net/browse/",
  },
] as const

function OrganizationSettings() {
  const { data } = useDashboard()
  const me = useCurrentUser()
  const canEdit = useCan("org.manage")
  const org = me.org!
  const action = React.useMemo(
    () => saveOrgSettingsAction.bind(null, org.slug),
    [org.slug]
  )
  const { state, run, pending, key } = useFormAction(action)
  const saved: Record<string, string> = {
    name: org.name,
    findingPrefix: data.config.project ?? "",
    retestEmail: data.config.retestEmail ?? "",
    jiraBaseUrl: data.config.base ?? "",
  }
  const values = state?.values ?? saved

  return (
    <form action={run} noValidate key={key}>
      <SettingsSection
        id="organization"
        title="Company"
        description="Shared by everyone in this company. Changes are recorded in the audit log."
        scope={canEdit ? "Owners" : "Read only"}
        footer={
          canEdit && (
            <>
              <span aria-live="polite" className="mr-auto text-xs text-muted-foreground">
                {state?.error ?? state?.notice ?? ""}
              </span>
              <SubmitButton pending={pending} label="Save changes" pendingLabel="Saving…" />
            </>
          )
        }
      >
        {COMPANY_ROWS.map((row) => {
          const id = `org-${row.name}`
          const error = state?.fieldErrors?.[row.name]
          return (
            <SettingsRow key={row.name} label={row.label} description={row.description} htmlFor={id}>
              {canEdit ? (
                <Field data-invalid={!!error || undefined} className="max-w-sm">
                  <Input
                    id={id}
                    name={row.name}
                    type={"type" in row ? row.type : "text"}
                    defaultValue={values[row.name] ?? ""}
                    placeholder={"placeholder" in row ? row.placeholder : undefined}
                    maxLength={"maxLength" in row ? row.maxLength : undefined}
                    aria-invalid={!!error || undefined}
                    aria-describedby={error ? `${id}-error` : undefined}
                    className={row.name === "findingPrefix" ? "font-mono uppercase" : undefined}
                  />
                  {error && <FieldError id={`${id}-error`}>{error}</FieldError>}
                </Field>
              ) : (
                <p className="text-sm">{saved[row.name] || "Not set"}</p>
              )}
            </SettingsRow>
          )
        })}
      </SettingsSection>
    </form>
  )
}

function DataSection() {
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
      title="Data"
      description="Your company’s records are stored by Pentest Scout and shared with your team according to each person’s access."
      scope="Your access"
    >
      <SettingsRow
        label="You can see"
        description="Counts for the products you have access to."
      >
        <p className="text-sm tabular-nums">{counts}</p>
      </SettingsRow>
      <SettingsRow
        label="Export data"
        description="Download everything you can see as JSON. Exports are recorded in the company’s audit log."
      >
        <Button variant="outline" onClick={actions.exportData}>
          <DownloadIcon data-icon="inline-start" />
          Export JSON
        </Button>
      </SettingsRow>
    </SettingsSection>
  )
}
