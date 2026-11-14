import type { Metadata } from "next"
import Link from "next/link"

import { SetPasswordForm } from "@/components/auth/set-password-form"
import { AuthHeading, AuthShell } from "@/components/auth/auth-shell"
import { Button } from "@/components/ui/button"
import { findToken } from "@/lib/auth/tokens"

export const metadata: Metadata = { title: "Set your password" }

export default async function SetPasswordPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const row = await findToken(token).catch((error) => {
    console.error("token lookup failed", error)
    return undefined
  })

  return (
    <AuthShell>
      {row ? (
        <>
          <AuthHeading
            title={
              row.purpose === "org_invite"
                ? `Join ${row.orgName ?? "your team"}`
                : "Set a new password"
            }
          >
            {row.purpose === "org_invite"
              ? `Welcome, ${row.name.split(" ")[0]}. Choose a password to activate your account. You’ll sign in with `
              : "Choose a new password for "}
            <span className="font-medium text-foreground">{row.email}</span>.
          </AuthHeading>
          <SetPasswordForm token={token} email={row.email} />
        </>
      ) : (
        <>
          <AuthHeading
            title={row === undefined ? "Something went wrong" : "This link no longer works"}
          >
            {row === undefined
              ? "We couldn’t check this link just now. Try again in a minute."
              : "It has expired or was already used. Ask an Owner on your team for a new one, or reset your password from the sign-in page."}
          </AuthHeading>
          <Button asChild variant="outline" className="h-11 w-fit">
            <Link href="/login">Go to sign in</Link>
          </Button>
        </>
      )}
    </AuthShell>
  )
}
