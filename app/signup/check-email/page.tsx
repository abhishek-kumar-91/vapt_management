import type { Metadata } from "next"
import Link from "next/link"
import { MailIcon } from "lucide-react"

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
    <AuthShell step={0}>
      <span aria-hidden className="relative grid size-14 place-items-center rounded-full bg-muted text-foreground">
        <span className="absolute inset-0 animate-scope-pulse-slow rounded-full ring-1 ring-foreground/40 [--pulse-to:1.45]" />
        <MailIcon className="size-6" />
      </span>
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
