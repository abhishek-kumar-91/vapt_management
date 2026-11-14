import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { BrandPanel } from "@/components/auth/brand-panel"
import { LoginForm } from "@/components/auth/login-form"
import { BrandMark } from "@/components/brand-mark"
import { ThemeToggle } from "@/components/theme-toggle"
import { getSession } from "@/lib/auth/session"
import { safeNext } from "@/lib/auth/shared"

export const metadata: Metadata = { title: "Sign in" }

const NOTICES = {
  signed_out: "You’ve signed out.",
  expired: "Your session ended. Sign in again to continue.",
} as const

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const next = safeNext(params.next)

  // Already signed in: skip the form. A database hiccup here just shows the form.
  const session = await getSession().catch(() => null)
  if (session) redirect(next)

  const notice = (Object.keys(NOTICES) as (keyof typeof NOTICES)[]).find(
    (key) => params[key] !== undefined
  )

  return (
    <main className="grid min-h-svh bg-sidebar p-2 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-2">
      <BrandPanel />

      <div className="relative flex flex-col rounded-4xl bg-background px-6 py-6 shadow-md ring-1 ring-foreground/5 sm:px-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 lg:invisible">
            <BrandMark className="size-7" />
            <span className="font-semibold tracking-tight">Pentest Scout</span>
          </div>
          <ThemeToggle />
        </div>

        <div className="mx-auto my-auto grid w-full max-w-sm animate-settle gap-8 py-12">
          <div className="grid gap-2">
            <h1 className="text-3xl font-semibold tracking-tight">Sign in</h1>
            <p className="text-muted-foreground">
              Use your work email to open the Pentest Scout security console.
            </p>
          </div>
          <LoginForm next={next} notice={notice && NOTICES[notice]} />
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Confidential · internal use only
        </p>
      </div>
    </main>
  )
}
