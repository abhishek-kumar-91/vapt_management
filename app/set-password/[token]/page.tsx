import type { Metadata } from "next"
import Link from "next/link"

import { SetPasswordForm } from "@/components/auth/set-password-form"
import { BrandMark } from "@/components/brand-mark"
import { ThemeToggle } from "@/components/theme-toggle"
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
    <main className="grid min-h-svh bg-sidebar p-2">
      <div className="relative flex flex-col rounded-4xl bg-background px-6 py-6 shadow-md ring-1 ring-foreground/5 sm:px-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <BrandMark className="size-7" />
            <span className="font-semibold tracking-tight">Pentest Scout</span>
          </div>
          <ThemeToggle />
        </div>

        <div className="mx-auto my-auto grid w-full max-w-sm animate-settle gap-8 py-12">
          {row ? (
            <>
              <div className="grid gap-2">
                <h1 className="text-3xl font-semibold tracking-tight text-balance">
                  {row.purpose === "org_invite"
                    ? `Join ${row.orgName ?? "your team"}`
                    : "Set a new password"}
                </h1>
                <p className="text-muted-foreground">
                  {row.purpose === "org_invite"
                    ? `Welcome, ${row.name.split(" ")[0]}. Choose a password to activate your account. You’ll sign in with `
                    : "Choose a new password for "}
                  <span className="font-medium text-foreground">
                    {row.email}
                  </span>
                  .
                </p>
              </div>
              <SetPasswordForm token={token} email={row.email} />
            </>
          ) : (
            <div className="grid gap-4">
              <h1 className="text-3xl font-semibold tracking-tight">
                {row === undefined
                  ? "Something went wrong"
                  : "This link no longer works"}
              </h1>
              <p className="text-pretty text-muted-foreground">
                {row === undefined
                  ? "We couldn’t check this link just now. Try again in a minute."
                  : "It has expired or was already used. Ask an Owner on your team to send you a new one."}
              </p>
              <Button asChild variant="outline" className="h-11 w-fit">
                <Link href="/login">Go to sign in</Link>
              </Button>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Confidential · internal use only
        </p>
      </div>
    </main>
  )
}
