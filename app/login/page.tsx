import type { Metadata } from "next"

import { BrandPanel } from "@/components/auth/brand-panel"
import { LoginForm } from "@/components/auth/login-form"
import { SentinelMark } from "@/components/sentinel-mark"
import { ThemeToggle } from "@/components/theme-toggle"

export const metadata: Metadata = { title: "Sign in" }

export default function LoginPage() {
  return (
    <main className="grid min-h-svh bg-sidebar p-2 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-2">
      <BrandPanel />

      <div className="relative flex flex-col rounded-4xl bg-background px-6 py-6 shadow-md ring-1 ring-foreground/5 sm:px-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 lg:invisible">
            <SentinelMark />
            <span className="font-semibold tracking-tight">Sentinel</span>
          </div>
          <ThemeToggle />
        </div>

        <div className="mx-auto my-auto grid w-full max-w-sm animate-settle gap-8 py-12">
          <div className="grid gap-2">
            <h1 className="text-3xl font-semibold tracking-tight">Sign in</h1>
            <p className="text-muted-foreground">
              Use your work email to open the Sentinel security console.
            </p>
          </div>
          <LoginForm />
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Confidential · internal use only
        </p>
      </div>
    </main>
  )
}
