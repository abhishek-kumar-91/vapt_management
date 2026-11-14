import { cookies } from "next/headers"

import { APPEARANCE_COOKIE, type Appearance } from "@/lib/appearance"
import { ConsoleShell } from "@/components/console-shell"

export default async function ConsoleLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const stored = (await cookies()).get(APPEARANCE_COOKIE)?.value
  const appearance: Appearance =
    stored === "dark-sidebar" ? "dark-sidebar" : "default"
  return <ConsoleShell initialAppearance={appearance}>{children}</ConsoleShell>
}
