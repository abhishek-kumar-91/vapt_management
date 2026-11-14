import type { Metadata } from "next"
import Link from "next/link"

import { AuthHeading, AuthShell } from "@/components/auth/auth-shell"
import { DevLink } from "@/components/auth/dev-link"
import { showLinksOnScreen } from "@/lib/email/send"

export const metadata: Metadata = { title: "Check your email" }

export default async function CheckEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; dev?: string }>
}) {
  const { email, dev } = await searchParams
  return (
    <AuthShell>
      <AuthHeading title="Check your email">
        If {email ? <span className="font-medium text-foreground">{email}</span> : "that address"} is
        new to Pentest Scout, we’ve sent it a link to confirm your account. It
        expires in 24 hours. Already have an account? We’ve emailed you a way
        back in instead.
      </AuthHeading>
      {showLinksOnScreen() && <DevLink href={dev} />}
      <p className="text-sm text-muted-foreground">
        Wrong address?{" "}
        <Link href="/signup" className="font-medium text-primary underline-offset-4 hover:underline">
          Start again
        </Link>
      </p>
    </AuthShell>
  )
}
