import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"

import { signUp } from "@/app/actions/account"
import { AuthHeading, AuthShell } from "@/components/auth/auth-shell"
import { ActionForm } from "@/components/forms/action-form"
import { getSession } from "@/lib/auth/session"
import { PASSWORD_MIN } from "@/lib/auth/password-rules"

export const metadata: Metadata = { title: "Register your company" }

export default async function SignUpPage() {
  if (await getSession().catch(() => null)) redirect("/dashboard")
  return (
    <AuthShell>
      <AuthHeading title="Register your company">
        Create your account, then add your company and the products you want to
        track. Pentest Scout reviews every company before it goes live.
      </AuthHeading>
      <ActionForm
        action={signUp}
        honeypot
        submitLabel="Create account"
        pendingLabel="Creating account…"
        fields={[
          { name: "name", label: "Full name", autoComplete: "name", maxLength: 120 },
          {
            name: "email",
            label: "Work email",
            type: "email",
            autoComplete: "email",
            placeholder: "name@company.com",
            maxLength: 254,
          },
          {
            name: "password",
            label: "Password",
            type: "password",
            autoComplete: "new-password",
            description: `At least ${PASSWORD_MIN} characters. A short sentence is easy to remember and hard to guess.`,
            maxLength: 128,
          },
        ]}
      />
      <p className="text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-primary underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </AuthShell>
  )
}
