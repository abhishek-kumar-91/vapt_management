"use client"

import * as React from "react"
import { MonitorIcon, MoonIcon, SunIcon, type LucideIcon } from "lucide-react"
import { useTheme } from "next-themes"

import { switchTheme } from "@/lib/theme-transition"
import { cn } from "@/lib/utils"

const OPTIONS: { value: string; label: string; icon: LucideIcon }[] = [
  { value: "light", label: "Light", icon: SunIcon },
  { value: "dark", label: "Dark", icon: MoonIcon },
  { value: "system", label: "System", icon: MonitorIcon },
]

/**
 * Segmented Light / Dark / System control on native radios (arrow keys work).
 * Light and dark use the same circular reveal as the header toggle.
 */
export function ThemePicker() {
  const { theme, setTheme } = useTheme()
  // next-themes only knows the stored theme after mount.
  const [mounted, setMounted] = React.useState(false)
  // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time mount flag
  React.useEffect(() => setMounted(true), [])
  const current = mounted ? theme : undefined

  return (
    <fieldset className="inline-flex max-w-full gap-1 rounded-full bg-muted p-1">
      <legend className="sr-only">Theme</legend>
      {OPTIONS.map(({ value, label, icon: Icon }) => {
        const selected = current === value
        return (
          <label
            key={value}
            className={cn(
              "flex h-8 cursor-pointer items-center gap-1.5 rounded-full px-3.5 text-sm font-medium transition-[background-color,color,box-shadow]",
              "has-focus-visible:ring-3 has-focus-visible:ring-ring/30",
              selected
                ? "bg-card text-foreground shadow-xs ring-1 ring-foreground/5"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <input
              type="radio"
              name="theme"
              value={value}
              checked={selected}
              onChange={(event) => {
                if (value === "system") setTheme("system")
                else
                  switchTheme(
                    value as "light" | "dark",
                    setTheme,
                    event.currentTarget.parentElement
                  )
              }}
              className="sr-only"
            />
            <Icon className="size-4" aria-hidden />
            {label}
          </label>
        )
      })}
    </fieldset>
  )
}
