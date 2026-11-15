import { cookies } from "next/headers"
import { notFound, redirect } from "next/navigation"

import { AdminBanner } from "@/components/admin-banner"
import { NoCompany } from "@/components/auth/no-company"
import { ConsoleShell } from "@/components/console-shell"
import { APPEARANCE_COOKIE, type Appearance } from "@/lib/appearance"
import { getSession, hasSessionCookie } from "@/lib/auth/session"
import { getContext, toSessionUser } from "@/server/context"
import { loadDashboard } from "@/server/domain"

/** The company console. Membership (or Super Admin) is checked against the database here. */
export default async function OrgLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ org: string }>
}) {
  const session = await getSession()
  if (!session)
    redirect((await hasSessionCookie()) ? "/login?expired=1" : "/login")

  const ctx = await getContext((await params).org)
  // Not a member: 404, so the response never confirms the company exists.
  if (!ctx) notFound()

  const platform = ctx.user.platform
  if (ctx.org.status !== "active" && !platform) {
    if (["draft", "pending_review", "rejected"].includes(ctx.org.status))
      redirect("/onboarding")
    return (
      <NoCompany
        email={session.user.email}
        orgName={ctx.org.name}
        reason="locked"
      />
    )
  }

  const stored = (await cookies()).get(APPEARANCE_COOKIE)?.value
  const appearance: Appearance =
    stored === "dark-sidebar" ? "dark-sidebar" : "default"
  const [user, data] = await Promise.all([toSessionUser(ctx), loadDashboard(ctx)])
  return (
    <ConsoleShell initialAppearance={appearance} user={user} data={data}>
      {platform && <AdminBanner orgName={ctx.org.name} />}
      {children}
    </ConsoleShell>
  )
}
