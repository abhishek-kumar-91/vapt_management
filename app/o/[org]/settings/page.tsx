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
import { ActionForm } from "@/components/forms/action-form"

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

function OrganizationSettings() {
  const { data } = useDashboard()
  const me = useCurrentUser()
  const canEdit = useCan("org.manage")
  const org = me.org!
  const action = React.useMemo(
    () => saveOrgSettingsAction.bind(null, org.slug),
    [org.slug]
  )
  const values = [
    ["Company name", org.name],
    ["Finding key prefix", data.config.project ?? "—"],
    ["Retest email", data.config.retestEmail || "Not set"],
    ["Jira base URL", data.config.base || "Not set"],
  ]
  return (
    <SettingsSection
      id="organization"
      title="Company"
      description="Shared by everyone in this company. Changes are recorded in the audit log."
      scope={canEdit ? "Owners" : "Read only"}
    >
      {canEdit ? (
        <div className="py-5">
          <ActionForm
            action={action}
            submitLabel="Save company settings"
            pendingLabel="Saving…"
            className="max-w-xl"
            fields={[
              { name: "name", label: "Company name", defaultValue: org.name, maxLength: 80 },
              {
                name: "findingPrefix",
                label: "Finding key prefix",
                defaultValue: data.config.project,
                maxLength: 10,
                half: true,
                description: "Findings are numbered PREFIX-1, PREFIX-2… Locked once the first finding exists.",
              },
              {
                name: "retestEmail",
                label: "Retest email",
                type: "email",
                defaultValue: data.config.retestEmail,
                half: true,
                placeholder: "security-tester@company.com",
                description: "Retest requests open an email draft to this address.",
              },
              {
                name: "jiraBaseUrl",
                label: "Jira base URL",
                type: "url",
                defaultValue: data.config.base,
                placeholder: "https://company.atlassian.net/browse/",
                description: "Jira keys on test areas and findings link here.",
              },
            ]}
          />
        </div>
      ) : (
        values.map(([label, value]) => (
          <SettingsRow key={label} label={label}>
            <p className="text-sm">{value}</p>
          </SettingsRow>
        ))
      )}
    </SettingsSection>
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
