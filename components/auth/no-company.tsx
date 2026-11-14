import { BrandMark } from "@/components/brand-mark"
import { ThemeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"
import { signOut } from "@/app/login/actions"

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
    <main className="grid min-h-svh bg-sidebar p-2">
      <div className="relative flex flex-col rounded-4xl bg-background px-6 py-6 shadow-md ring-1 ring-foreground/5 sm:px-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <BrandMark className="size-7" />
            <span className="font-semibold tracking-tight">Pentest Scout</span>
          </div>
          <ThemeToggle />
        </div>

        <div className="mx-auto my-auto grid w-full max-w-sm animate-settle gap-6 py-12">
          <div className="grid gap-2">
            <h1 className="text-3xl font-semibold tracking-tight text-balance">
              {copy.title(orgName)}
            </h1>
            <p className="text-pretty text-muted-foreground">
              {copy.body}{" "}
              Signed in as{" "}
              <span className="font-medium text-foreground">{email}</span>.
            </p>
          </div>
          <form action={signOut}>
            <Button type="submit" variant="outline" className="h-11 w-fit">
              Sign out
            </Button>
          </form>
        </div>
      </div>
    </main>
  )
}
