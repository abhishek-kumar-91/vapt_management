"use client"

import * as React from "react"
import { CheckIcon, InfoIcon } from "lucide-react"

import { PageHeader } from "@/components/page-header"
import { AppearancePicker } from "@/components/settings/appearance-picker"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { SOP_RULES } from "@/lib/sop"
import { useDashboard } from "@/lib/store"

export default function SettingsPage() {
  const { data, actions } = useDashboard()
  const [email, setEmail] = React.useState(data.config.retestEmail || "")
  const dirty = email.trim() !== (data.config.retestEmail || "")

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Settings"
        description="Appearance, retest routing and the SOP rules this console applies."
      />

      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>
            Choose how the navigation frame looks. Light and dark theme are
            switched from the header.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AppearancePicker />
        </CardContent>
      </Card>

      <form
        onSubmit={(event) => {
          event.preventDefault()
          actions.saveEmail(email.trim())
        }}
      >
        <Card>
          <CardHeader>
            <CardTitle>Retest routing</CardTitle>
            <CardDescription>
              When a developer clicks “Request retest”, the finding moves to
              Ready for Retest and a prefilled email draft opens to this
              address.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Field className="max-w-md">
              <FieldLabel htmlFor="retest-email">
                Security Tester email
              </FieldLabel>
              <Input
                id="retest-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="security-tester@company.com"
              />
              <FieldDescription>
                This browser-only app opens your email client; it can’t send
                email in the background.
              </FieldDescription>
            </Field>
          </CardContent>
          <CardFooter className="justify-end">
            <Button type="submit" disabled={!dirty}>
              Save email
            </Button>
          </CardFooter>
        </Card>
      </form>

      <Card>
        <CardHeader>
          <CardTitle>Workflow rules</CardTitle>
          <CardDescription>
            Application Security Testing SOP v1.0, as applied by this tracker
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-3">
            {SOP_RULES.map((rule) => (
              <li key={rule} className="flex gap-3 text-sm text-pretty">
                <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                  <CheckIcon className="size-3" strokeWidth={3} />
                </span>
                {rule}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <p className="flex gap-2.5 rounded-3xl bg-muted px-4 py-3 text-sm text-muted-foreground">
        <InfoIcon className="mt-0.5 size-4 shrink-0" />
        Records are stored in this browser’s local storage and are not shared
        across users or devices. Use Export JSON from the account menu to take a
        copy.
      </p>
    </div>
  )
}
