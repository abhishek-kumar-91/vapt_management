import { cookies } from "next/headers"
import { redirect } from "next/navigation"

import { NoCompany } from "@/components/auth/no-company"
import { getSession, hasSessionCookie } from "@/lib/auth/session"
import { homeFor, LAST_ORG_COOKIE } from "@/server/context"

/**
 * Old /dashboard/* links and the post-sign-in landing: send each person to their own home,
 * keeping the rest of the path for company pages (/dashboard/findings → /o/acme/findings).
 */
export default async function DashboardRedirect({
  params,
  searchParams,
}: {
  params: Promise<{ path?: string[] }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const session = await getSession()
  if (!session)
    redirect((await hasSessionCookie()) ? "/login?expired=1" : "/login")

  const home = await homeFor(
    session,
    (await cookies()).get(LAST_ORG_COOKIE)?.value
  )
  if (!home) return <NoCompany email={session.user.email} />
  if (!home.startsWith("/o/")) redirect(home)

  const { path = [] } = await params
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(await searchParams))
    for (const v of [value ?? []].flat()) query.append(key, v)
  const rest = path.map(encodeURIComponent).join("/")
  redirect(`${home}${rest ? `/${rest}` : ""}${query.size ? `?${query}` : ""}`)
}
