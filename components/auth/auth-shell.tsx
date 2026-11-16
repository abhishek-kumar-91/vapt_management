import { BrandPanel } from "@/components/auth/brand-panel"
import {
  OnboardingJourney,
  OnboardingProgress,
} from "@/components/auth/onboarding-steps"
import { BrandMark } from "@/components/brand-mark"
import { ThemeToggle } from "@/components/theme-toggle"
import { cn } from "@/lib/utils"

/**
 * The frame for standalone account pages (verify, invite, forgot password, onboarding):
 * brand row, one focused column, and the confidentiality line. Same frame as set-password.
 * Pages on the sign-up path pass `step`: the frame then splits like sign-in, with the brand
 * panel telling the journey and a progress pill above the heading.
 */
export function AuthShell({
  children,
  wide = false,
  aside,
  step,
}: {
  children: React.ReactNode
  /** Onboarding forms need more room than a sign-in column. */
  wide?: boolean
  /** Shown at the top right, before the theme toggle (e.g. a sign-out button). */
  aside?: React.ReactNode
  /** Index into ONBOARDING_STEPS for pages on the sign-up path. */
  step?: number
}) {
  const journey = step !== undefined

  return (
    <main
      className={cn(
        "grid min-h-svh bg-sidebar p-2",
        journey &&
          (wide
            ? "lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-2"
            : "lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-2")
      )}
    >
      {journey && (
        <BrandPanel
          title="Bring your company into Pentest Scout."
          description="Four short steps from here to a live workspace for your security testing."
        >
          <OnboardingJourney current={step} />
        </BrandPanel>
      )}

      <div className="relative flex flex-col rounded-4xl bg-background px-6 py-6 shadow-md ring-1 ring-foreground/5 sm:px-10">
        <div className="flex items-center justify-between gap-3">
          <div className={cn("flex items-center gap-2.5", journey && "lg:invisible")}>
            <BrandMark className="size-7" />
            <span className="font-semibold tracking-tight">Pentest Scout</span>
          </div>
          <div className="flex items-center gap-1">
            {aside}
            <ThemeToggle />
          </div>
        </div>

        <div
          className={cn(
            "mx-auto my-auto grid w-full animate-settle gap-8 py-12",
            wide ? "max-w-2xl" : "max-w-sm"
          )}
        >
          {journey && <OnboardingProgress current={step} />}
          {children}
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Confidential · internal use only
        </p>
      </div>
    </main>
  )
}

/** Page heading + supporting line, used at the top of every AuthShell page. */
export function AuthHeading({
  title,
  children,
}: {
  title: string
  children?: React.ReactNode
}) {
  return (
    <div className="grid gap-2">
      <h1 className="text-3xl font-semibold tracking-tight text-balance">
        {title}
      </h1>
      {children && (
        <p className="text-pretty text-muted-foreground">{children}</p>
      )}
    </div>
  )
}

export { DevLink } from "./dev-link"
