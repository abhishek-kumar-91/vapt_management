import { signOut } from "@/app/login/actions"
import { AuthHeading, AuthShell } from "@/components/auth/auth-shell"
import { Button } from "@/components/ui/button"

const COPY = {
  none: {
    title: () => "No company to open",
    body: "You’re signed in, but you aren’t an active member of any company. Ask your company’s Owner to invite you, or sign up to register your company.",
  },
  locked: {
    title: (org: string) => `${org} is locked`,
    body: "This company’s access is suspended. Its data is kept. Contact Pentest Scout support to restore access.",
  },
}

/** Shown to a signed-in person with nothing to open: no company, or a suspended or closed one. */
export function NoCompany({
  email,
  orgName = "",
  reason = "none",
}: {
  email: string
  orgName?: string
  reason?: keyof typeof COPY
}) {
  const copy = COPY[reason]
  return (
    <AuthShell>
      <AuthHeading title={copy.title(orgName)}>
        {copy.body} Signed in as <span className="font-medium text-foreground">{email}</span>.
      </AuthHeading>
      <form action={signOut}>
        <Button type="submit" variant="outline" className="h-11 w-fit">
          Sign out
        </Button>
      </form>
    </AuthShell>
  )
}
