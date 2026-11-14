import type { Metadata } from "next"
import { eq, sql } from "drizzle-orm"

import { AdminShell } from "@/components/admin/admin-shell"
import { organizations, testingRequests } from "@/db/schema"
import { adminRead, requirePlatform } from "@/server/admin"

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · Admin · Pentest Scout" },
}

/** Super Admins only; everyone else gets a 404 (the area's existence isn't confirmed). */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await requirePlatform()
  const [[approvals], [testing]] = await adminRead((tx) =>
    Promise.all([
      tx
        .select({ n: sql<number>`count(*)::int` })
        .from(organizations)
        .where(eq(organizations.status, "pending_review")),
      tx
        .select({ n: sql<number>`count(*)::int` })
        .from(testingRequests)
        .where(eq(testingRequests.status, "submitted")),
    ])
  )
  return (
    <AdminShell
      user={{ name: session.user.name, email: session.user.email }}
      counts={{ approvals: approvals.n, testing: testing.n }}
    >
      {children}
    </AdminShell>
  )
}
