"use client"

import * as React from "react"

import { APPEARANCE_COOKIE, type Appearance } from "@/lib/appearance"
import { fadeTransition } from "@/lib/theme-transition"

const AppearanceContext = React.createContext<{
  appearance: Appearance
  setAppearance: (value: Appearance) => void
} | null>(null)

/** Shell appearance (sidebar style). Persisted in a cookie so the server renders it without a flash. */
export function AppearanceProvider({
  initial,
  children,
}: {
  initial: Appearance
  children: React.ReactNode
}) {
  const [appearance, setState] = React.useState<Appearance>(initial)

  const setAppearance = React.useCallback((value: Appearance) => {
    document.cookie = `${APPEARANCE_COOKIE}=${value}; path=/; max-age=31536000; samesite=lax`
    fadeTransition(() => setState(value))
  }, [])

  const value = React.useMemo(
    () => ({ appearance, setAppearance }),
    [appearance, setAppearance]
  )
  return (
    <AppearanceContext.Provider value={value}>
      {children}
    </AppearanceContext.Provider>
  )
}

export function useAppearance() {
  const context = React.useContext(AppearanceContext)
  if (!context)
    throw new Error("useAppearance must be used inside <AppearanceProvider>.")
  return context
}
