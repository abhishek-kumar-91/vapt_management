"use client"

import * as React from "react"

import { can, roleHas, type Permission } from "@/lib/auth/roles"
import type { SessionUser } from "@/lib/auth/shared"

const CurrentUserContext = React.createContext<SessionUser | null>(null)

/** The signed-in user, provided once by the dashboard layout from the server session. */
export function CurrentUserProvider({
  user,
  children,
}: {
  user: SessionUser
  children: React.ReactNode
}) {
  return (
    <CurrentUserContext.Provider value={user}>
      {children}
    </CurrentUserContext.Provider>
  )
}

export function useCurrentUser() {
  const user = React.useContext(CurrentUserContext)
  if (!user)
    throw new Error("useCurrentUser must be used inside the dashboard.")
  return user
}

/**
 * For showing or hiding UI only. The server checks every action again; this is never the gate.
 * With productId, applies the role's product scope; without, asks "has this permission anywhere".
 */
export function useCan(permission: Permission, productId?: string) {
  const user = useCurrentUser()
  return productId === undefined
    ? roleHas(user.role, permission)
    : can(user, permission, productId)
}
