import Link from "next/link"
import { ShieldCheckIcon } from "lucide-react"

/** Shown to Super Admins inside a company console: every action here is theirs, and audited. */
export function AdminBanner({ orgName }: { orgName: string }) {
  return (
    <div
      role="status"
      className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl bg-primary/8 px-4 py-2.5 text-sm text-foreground ring-1 ring-primary/15"
    >
      <ShieldCheckIcon className="size-4 shrink-0 text-primary" aria-hidden />
      <span>
        Acting in <span className="font-medium">{orgName}</span> as a Pentest
        Scout admin. Every change is recorded in this company’s audit log.
      </span>
      <Link
        href="/admin"
        className="ml-auto font-medium text-primary underline-offset-4 hover:underline"
      >
        Back to admin
      </Link>
    </div>
  )
}
