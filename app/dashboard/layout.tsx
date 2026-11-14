import { cookies } from "next/headers"
import { redirect } from "next/navigation"

import { APPEARANCE_COOKIE, type Appearance } from "@/lib/appearance"
import { ConsoleShell } from "@/components/console-shell"
import { getSession, hasSessionCookie } from "@/lib/auth/session"

export default async function ConsoleLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSession()
  if (!session)
    redirect((await hasSessionCookie()) ? "/login?expired=1" : "/login")

  const stored = (await cookies()).get(APPEARANCE_COOKIE)?.value
  const appearance: Appearance =
    stored === "dark-sidebar" ? "dark-sidebar" : "default"
  return (
    <ConsoleShell initialAppearance={appearance} user={session.user}>
      {children}
    </ConsoleShell>
  )
}
