"use client"

import { CheckIcon } from "lucide-react"

import { useAppearance } from "@/components/appearance"
import type { Appearance } from "@/lib/appearance"
import { cn } from "@/lib/utils"

const OPTIONS: { value: Appearance; label: string; description: string }[] = [
  {
    value: "default",
    label: "Default",
    description: "Light sidebar that follows the theme",
  },
  {
    value: "dark-sidebar",
    label: "Dark sidebar",
    description: "Dark navigation frame, light content",
  },
]

/** Miniature of the shell: frame + sidebar lines + inset content card. */
function Preview({ dark }: { dark: boolean }) {
  return (
    <div
      aria-hidden
      className={cn(
        "flex h-28 gap-1.5 rounded-2xl p-1.5 ring-1 ring-foreground/5",
        dark ? "bg-sidebar-contrast" : "bg-sidebar"
      )}
    >
      <div className="flex w-[30%] flex-col gap-1.5 p-1.5">
        <span className="size-3 rounded-full bg-primary" />
        {[70, 55, 62, 48].map((w, i) => (
          <span
            key={w}
            className={cn(
              "h-1.5 rounded-full",
              dark ? "bg-white/20" : "bg-foreground/12",
              i === 0 && "bg-primary/60"
            )}
            style={{ width: `${w}%` }}
          />
        ))}
      </div>
      <div className="flex flex-1 flex-col gap-1.5 rounded-xl bg-white p-2 shadow-sm">
        <span className="h-1.5 w-1/3 rounded-full bg-foreground/15" />
        <span className="h-6 rounded-lg bg-[oklch(0.962_0.006_275)]" />
        <div className="grid flex-1 grid-cols-2 gap-1.5">
          <span className="rounded-lg bg-[oklch(0.962_0.006_275)]" />
          <span className="rounded-lg bg-[oklch(0.962_0.006_275)]" />
        </div>
      </div>
    </div>
  )
}

export function AppearancePicker() {
  const { appearance, setAppearance } = useAppearance()

  return (
    <fieldset className="grid gap-3 sm:grid-cols-2">
      <legend className="sr-only">Shell appearance</legend>
      {OPTIONS.map((option) => {
        const selected = appearance === option.value
        return (
          <label
            key={option.value}
            className={cn(
              "group relative grid cursor-pointer gap-3 rounded-3xl p-2 pb-3 ring-1 transition-[box-shadow,background-color] duration-200",
              "has-focus-visible:ring-3 has-focus-visible:ring-ring/30",
              selected
                ? "bg-primary/6 ring-2 ring-primary"
                : "ring-border hover:bg-muted/50"
            )}
          >
            <input
              type="radio"
              name="appearance"
              value={option.value}
              checked={selected}
              onChange={() => setAppearance(option.value)}
              className="sr-only"
            />
            <Preview dark={option.value === "dark-sidebar"} />
            <span className="flex items-start justify-between gap-3 px-2">
              <span className="grid gap-0.5">
                <span className="text-sm font-medium">{option.label}</span>
                <span className="text-xs text-muted-foreground">
                  {option.description}
                </span>
              </span>
              <span
                className={cn(
                  "mt-0.5 grid size-5 shrink-0 place-items-center rounded-full ring-1 transition-colors",
                  selected
                    ? "bg-primary text-primary-foreground ring-primary"
                    : "ring-border"
                )}
              >
                {selected && <CheckIcon className="size-3" strokeWidth={3} />}
              </span>
            </span>
          </label>
        )
      })}
    </fieldset>
  )
}
