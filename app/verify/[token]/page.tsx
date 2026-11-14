import type { Metadata } from "next"
import Link from "next/link"

import { verifyEmail } from "@/app/actions/account"
import { ActionButton } from "@/components/auth/action-button"
import { AuthHeading, AuthShell } from "@/components/auth/auth-shell"
import { Button } from "@/components/ui/button"
import { lookupToken } from "@/lib/auth/tokens"

export const metadata: Metadata = { title: "Confirm your email" }

/**
 * Confirming takes a click, not just a visit: link scanners in mail systems open links
 * automatically, and they shouldn't use up the token.
 */
export default async function VerifyPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const row = await lookupToken(token, "email_verify").catch(() => undefined)

  if (!row)
    return (
      <AuthShell>
        <AuthHeading title={row === undefined ? "Something went wrong" : "This link no longer works"}>
          {row === undefined
            ? "We couldn’t check this link just now. Try again in a minute."
            : "It has expired or was already used. Sign in and we’ll offer to send a new one."}
        </AuthHeading>
        <Button asChild variant="outline" className="h-11 w-fit">
          <Link href="/login">Go to sign in</Link>
        </Button>
      </AuthShell>
    )

  return (
    <AuthShell>
      <AuthHeading title="Confirm your email">
        Confirm that <span className="font-medium text-foreground">{row.email}</span> is
        yours to continue setting up your company.
      </AuthHeading>
      <ActionButton
        action={verifyEmail.bind(null, token)}
        label="Confirm email"
        pendingLabel="Confirming…"
      />
    </AuthShell>
  )
}
