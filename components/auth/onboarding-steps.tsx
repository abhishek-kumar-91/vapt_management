import { CheckIcon } from "lucide-react"

import { cn } from "@/lib/utils"

/** The self-serve path from sign-up to a live workspace. Index = the `step` an AuthShell page passes. */
export const ONBOARDING_STEPS = [
  {
    title: "Create your account",
    detail: "Your name, work email and a password.",
  },
  { title: "Add your company", detail: "Its name and workspace address." },
  {
    title: "Add products to track",
    detail: "Each starts with the standard test areas for its tier.",
  },
  {
    title: "Submit for review",
    detail: "Pentest Scout approves every company before it goes live.",
  },
] as const

/**
 * Segmented progress pill above the page heading, drawn in the close-out meter's grammar:
 * finished steps in ink, the current one in ink at 35%, the rest as empty track.
 */
export function OnboardingProgress({ current }: { current: number }) {
  const step = ONBOARDING_STEPS[current]
  return (
    <div className="grid gap-2.5">
      <div aria-hidden className="flex gap-1">
        {ONBOARDING_STEPS.map((s, i) => (
          <span
            key={s.title}
            className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"
          >
            {i <= current && (
              <span
                className={cn(
                  "block h-full animate-reveal-x rounded-full",
                  i < current ? "bg-primary" : "bg-primary/35"
                )}
                style={{ animationDelay: `${120 + i * 90}ms` }}
              />
            )}
          </span>
        ))}
      </div>
      <p className="text-xs text-muted-foreground tabular">
        Step {current + 1} of {ONBOARDING_STEPS.length}
        <span aria-hidden> · </span>
        <span className="sr-only">: </span>
        <span className="font-medium text-foreground">{step.title}</span>
      </p>
    </div>
  )
}

/** The same path as a vertical journey on the dark brand panel. */
export function OnboardingJourney({ current }: { current: number }) {
  return (
    <ol aria-label="Steps to a live workspace" className="grid">
      {ONBOARDING_STEPS.map((s, i) => {
        const done = i < current
        const now = i === current
        const last = i === ONBOARDING_STEPS.length - 1
        return (
          <li
            key={s.title}
            aria-current={now ? "step" : undefined}
            className="relative grid animate-settle grid-cols-[1.5rem_1fr] gap-x-4 pb-6 last:pb-0 [@media(max-height:860px)]:pb-4"
            style={{ animationDelay: `${260 + i * 70}ms` }}
          >
            {!last && (
              <span
                aria-hidden
                className="absolute top-7 bottom-1 left-[0.6875rem] w-0.5 overflow-hidden rounded-full bg-white/12 [@media(max-height:860px)]:top-6.5 [@media(max-height:860px)]:-bottom-0.5"
              >
                {done && (
                  <span
                    className="block h-full origin-top animate-draw-down rounded-full bg-white"
                    style={{ animationDelay: `${420 + i * 120}ms` }}
                  />
                )}
              </span>
            )}
            <span
              aria-hidden
              className={cn(
                "relative grid size-6 place-items-center rounded-full",
                done && "bg-white text-primary dark:text-[oklch(0.22_0_0)]",
                now && "bg-white ring-4 ring-white/15",
                !done && !now && "ring-1 ring-white/30 ring-inset"
              )}
            >
              {done && <CheckIcon className="size-3.5" strokeWidth={3} />}
              {now && (
                <>
                  <span className="size-2 rounded-full bg-primary dark:bg-[oklch(0.22_0_0)]" />
                  <span className="absolute inset-0 animate-scope-pulse-slow rounded-full ring-1 ring-white" />
                </>
              )}
            </span>
            <span className="grid gap-0.5 pt-0.5">
              <span
                className={cn(
                  "text-sm font-medium",
                  !done && !now && "text-white/60"
                )}
              >
                <span className="sr-only">
                  {done ? "Done: " : now ? "Current step: " : "Next: "}
                </span>
                {s.title}
              </span>
              <span
                className={cn(
                  "text-sm text-pretty [@media(max-height:860px)]:hidden",
                  now ? "text-white/75" : "text-white/55"
                )}
              >
                {s.detail}
              </span>
            </span>
          </li>
        )
      })}
    </ol>
  )
}
