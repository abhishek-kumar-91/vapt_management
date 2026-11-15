import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"

import { acceptInvite } from "@/app/actions/account"
import { signOut } from "@/app/login/actions"
import { ActionButton } from "@/components/auth/action-button"
import { AuthHeading, AuthShell } from "@/components/auth/auth-shell"
import { Button } from "@/components/ui/button"
import { getSession } from "@/lib/auth/session"
import { lookupToken } from "@/lib/auth/tokens"

export const metadata: Metadata = { title: "Join a company" }

/**
 * A company invite. Someone without a password yet chooses one on /set-password; an existing
 * account signs in (if needed) and accepts here.
 */
export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const row = await lookupToken(token, "org_invite").catch(() => undefined)

  if (!row)
    return (
      <AuthShell>
        <AuthHeading title={row === undefined ? "Something went wrong" : "This invite no longer works"}>
          {row === undefined
            ? "We couldn’t check this invite just now. Try again in a minute."
            : "It has expired, was cancelled, or was already used. Ask the company’s Owner for a new one."}
        </AuthHeading>
        <Button asChild variant="outline" className="h-11 w-fit">
          <Link href="/login">Go to sign in</Link>
        </Button>
      </AuthShell>
    )

  if (row.status === "invited" && !row.hasPassword) redirect(`/set-password/${token}`)

  const session = await getSession().catch(() => null)
  const company = row.orgName ?? "this company"

  if (!session)
    return (
      <AuthShell>
        <AuthHeading title={`Join ${company}`}>
          Sign in as <span className="font-medium text-foreground">{row.email}</span> to
          accept this invite.
        </AuthHeading>
        <Button asChild className="h-11 w-fit">
          <Link href={`/login?next=${encodeURIComponent(`/invite/${token}`)}`}>
            Sign in to accept
          </Link>
        </Button>
      </AuthShell>
    )

  if (session.user.id !== row.userId)
    return (
      <AuthShell>
        <AuthHeading title="This invite is for someone else">
          It was sent to <span className="font-medium text-foreground">{row.email}</span>, but
          you’re signed in as{" "}
          <span className="font-medium text-foreground">{session.user.email}</span>. Sign out,
          then open the link again.
        </AuthHeading>
        <form action={signOut}>
          <Button type="submit" variant="outline" className="h-11 w-fit">
            Sign out
          </Button>
        </form>
      </AuthShell>
    )

  return (
    <AuthShell>
      <AuthHeading title={`Join ${company}`}>
        You’ve been invited to {company} on Pentest Scout. Accept to add it to the
        companies you can open.
      </AuthHeading>
      <ActionButton
        action={acceptInvite.bind(null, token)}
        label="Accept invite"
        pendingLabel="Joining…"
      />
    </AuthShell>
  )
}
