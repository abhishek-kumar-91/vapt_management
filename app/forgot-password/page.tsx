import type { Metadata } from "next"
import Link from "next/link"

import { requestPasswordReset } from "@/app/actions/account"
import { AuthHeading, AuthShell } from "@/components/auth/auth-shell"
import { ActionForm } from "@/components/forms/action-form"

export const metadata: Metadata = { title: "Reset your password" }

export default function ForgotPasswordPage() {
  return (
    <AuthShell>
      <AuthHeading title="Reset your password">
        Enter your work email. If it has an account, we’ll send it a link to choose a
        new password.
      </AuthHeading>
      <ActionForm
        action={requestPasswordReset}
        size="lg"
        submitLabel="Send reset link"
        pendingLabel="Sending…"
        doneMessage="If that email has an account, a reset link is on its way. It expires in 24 hours."
        fields={[
          {
            name: "email",
            label: "Work email",
            type: "email",
            autoComplete: "email",
            placeholder: "name@company.com",
            maxLength: 254,
          },
        ]}
      />
      <p className="text-sm text-muted-foreground">
        Remembered it?{" "}
        <Link href="/login" className="font-medium text-primary underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </AuthShell>
  )
}
