import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { and, asc, eq, isNull, sql } from "drizzle-orm"
import {
  CheckCircle2Icon,
  CircleDashedIcon,
  CircleAlertIcon,
  ClockIcon,
  PencilIcon,
  PlusIcon,
} from "lucide-react"

import { resendVerification } from "@/app/actions/account"
import { signOut } from "@/app/login/actions"
import { ActionButton } from "@/components/auth/action-button"
import { AuthHeading, AuthShell } from "@/components/auth/auth-shell"
import { ActionForm } from "@/components/forms/action-form"
import { FormSheet } from "@/components/forms/form-sheet"
import { ProductAvatar } from "@/components/product-avatar"
import { RunAction } from "@/components/run-action"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty"
import { organizations, products, users } from "@/db/schema"
import { getSession } from "@/lib/auth/session"
import { formatDate, LONG_DATE } from "@/lib/dates"
import { companyFields, PRODUCT_FIELDS, SLUG_FIELD } from "@/lib/form-specs"
import { findOnboardingOrg, listMyOrgs, withScope } from "@/server/context"

import {
  addProductAction,
  createCompanyAction,
  removeProductAction,
  submitAction,
  updateCompanyAction,
} from "./actions"

export const metadata: Metadata = { title: "Set up your company" }

function SignOut() {
  return (
    <form action={signOut}>
      <Button type="submit" variant="ghost" size="sm">
        Sign out
      </Button>
    </form>
  )
}

function Check({ done, children }: { done: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3 text-sm">
      {done ? (
        <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
      ) : (
        <CircleDashedIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
      )}
      <span className={done ? undefined : "text-muted-foreground"}>
        <span className="sr-only">{done ? "Done: " : "To do: "}</span>
        {children}
      </span>
    </li>
  )
}

/**
 * Self-serve onboarding: create the company, add the products to track, then submit it for
 * Pentest Scout's review. While waiting (or after a rejection) everything stays editable here.
 */
export default async function OnboardingPage() {
  const session = await getSession()
  if (!session) redirect("/login?next=/onboarding")
  if (session.user.platform) redirect("/admin")

  const pending = await findOnboardingOrg(session.user.id)
  if (!pending) {
    const orgs = await listMyOrgs(session.user.id)
    if (orgs.length) redirect(`/o/${orgs[0].slug}`)
    const [name, ...rest] = companyFields()
    return (
      <AuthShell wide aside={<SignOut />}>
        <AuthHeading title="Tell us about your company">
          This becomes your company’s workspace on Pentest Scout. You’ll add the products to
          track next, then send it for review.
        </AuthHeading>
        <ActionForm
          action={createCompanyAction}
          size="lg"
          submitLabel="Create company"
          pendingLabel="Creating…"
          fields={[name, SLUG_FIELD, ...rest]}
        />
      </AuthShell>
    )
  }

  const scope = { orgId: pending.id, userId: session.user.id, platform: false }
  const [[org], [me], list] = await withScope(scope, (db) =>
    Promise.all([
      db
        .select({
          name: organizations.name,
          slug: organizations.slug,
          status: organizations.status,
          industry: organizations.industry,
          size: organizations.size,
          website: organizations.website,
          reviewNote: organizations.reviewNote,
          submittedAt: organizations.submittedAt,
        })
        .from(organizations)
        .where(eq(organizations.id, pending.id)),
      db.select({ verified: users.emailVerifiedAt }).from(users).where(eq(users.id, session.user.id)),
      db
        .select({
          slug: products.slug,
          name: products.name,
          tier: products.tier,
          areas: sql<number>`(select count(*)::int from test_areas a where a.product_id = "products"."id")`,
        })
        .from(products)
        .where(and(eq(products.orgId, pending.id), isNull(products.archivedAt)))
        .orderBy(asc(products.createdAt)),
    ])
  )

  const waiting = org.status === "pending_review"
  const canSubmit = org.status === "draft" || org.status === "rejected"
  const verified = !!me?.verified
  const ready = verified && list.length > 0
  const details: [string, string][] = [
    ["Workspace address", `/o/${org.slug}`],
    ["Industry", org.industry ?? "—"],
    ["Size", org.size ?? "—"],
    ["Website", org.website ?? "—"],
  ]

  return (
    <AuthShell wide aside={<SignOut />}>
      <AuthHeading title={waiting ? `${org.name} is waiting for review` : `Set up ${org.name}`}>
        {waiting
          ? "Pentest Scout reviews every company before it goes live, and we’ll email you as soon as it’s approved. You can keep editing below."
          : "Add the products you want to track, then submit your company for review. Pentest Scout approves every company before it goes live."}
      </AuthHeading>

      {waiting && org.submittedAt && (
        <Alert>
          <ClockIcon />
          <AlertTitle>Submitted {formatDate(org.submittedAt.toISOString().slice(0, 10), LONG_DATE)}</AlertTitle>
          <AlertDescription>Reviews usually take one working day.</AlertDescription>
        </Alert>
      )}
      {org.reviewNote && !waiting && (
        <Alert variant={org.status === "rejected" ? "destructive" : "default"}>
          <CircleAlertIcon />
          <AlertTitle>{org.status === "rejected" ? "Not approved yet" : "Changes requested"}</AlertTitle>
          <AlertDescription>{org.reviewNote} Make the changes below, then submit again.</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{org.name}</CardTitle>
          <CardDescription>Your company’s profile, as Pentest Scout reviews it</CardDescription>
          <CardAction>
            <FormSheet
              triggerLabel="Edit"
              triggerIcon={<PencilIcon data-icon="inline-start" />}
              triggerVariant="outline"
              title="Company details"
              description="The workspace address can’t change."
              action={updateCompanyAction}
              fields={companyFields({
                name: org.name,
                industry: org.industry ?? "",
                size: org.size ?? "",
                website: org.website ?? "",
              })}
              submitLabel="Save details"
              pendingLabel="Saving…"
              success="Company details saved"
            />
          </CardAction>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
            {details.map(([k, v]) => (
              <div key={k} className="grid gap-0.5">
                <dt className="text-xs text-muted-foreground">{k}</dt>
                <dd className="truncate text-sm">{v}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Products to track</CardTitle>
          <CardDescription>Each starts with the standard test areas for its tier</CardDescription>
          <CardAction>
            <FormSheet
              triggerLabel="Add product"
              triggerIcon={<PlusIcon data-icon="inline-start" />}
              triggerVariant={list.length ? "outline" : "default"}
              title="Add a product"
              description="You can add more, change test areas and invite your team once the company is live."
              action={addProductAction}
              fields={PRODUCT_FIELDS}
              submitLabel="Add product"
              pendingLabel="Adding…"
              success="Product added"
            />
          </CardAction>
        </CardHeader>
        <CardContent className="px-3">
          {list.length ? (
            <ul className="grid gap-0.5">
              {list.map((p) => (
                <li key={p.slug} className="flex items-center gap-3 rounded-3xl px-3 py-2.5">
                  <ProductAvatar id={p.slug} name={p.name} />
                  <span className="grid min-w-0 flex-1 gap-0.5">
                    <span className="truncate text-sm font-medium">{p.name}</span>
                    <span className="text-xs text-muted-foreground tabular">
                      Tier {p.tier} · {p.areas} test areas
                    </span>
                  </span>
                  <RunAction
                    variant="ghost"
                    label="Remove"
                    pendingLabel="Removing…"
                    success={`${p.name} removed.`}
                    confirm={{
                      title: `Remove ${p.name}?`,
                      description: "It and its test areas are deleted. You can add it again any time before your company goes live.",
                      confirmLabel: "Remove product",
                      destructive: true,
                    }}
                    action={removeProductAction.bind(null, p.slug)}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <Empty className="py-8">
              <EmptyHeader>
                <EmptyTitle>No products yet</EmptyTitle>
                <EmptyDescription>Add at least one product before you submit.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </CardContent>
      </Card>

      {canSubmit && (
        <Card>
          <CardHeader>
            <CardTitle>{org.status === "rejected" ? "Submit again" : "Submit for review"}</CardTitle>
            <CardDescription>Pentest Scout reviews the company and emails you when it’s live</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5">
            <ul className="grid gap-2.5">
              <Check done>Company details</Check>
              <Check done={list.length > 0}>At least one product to track</Check>
              <Check done={verified}>
                Email confirmed
                {!verified && <> · we sent a link to {session.user.email}</>}
              </Check>
            </ul>
            <div className="flex flex-wrap items-center gap-3">
              {ready ? (
                <RunAction
                  variant="default"
                  size="default"
                  label={org.status === "rejected" ? "Submit again" : "Submit for review"}
                  pendingLabel="Submitting…"
                  success="Submitted. We’ll email you when it’s approved."
                  confirm={{
                    title: `Submit ${org.name} for review?`,
                    description: "You can keep editing while Pentest Scout reviews it.",
                    confirmLabel: "Submit",
                  }}
                  action={submitAction}
                />
              ) : (
                <Button disabled>Submit for review</Button>
              )}
              {!verified && (
                <ActionButton
                  action={resendVerification}
                  label="Send a new confirmation link"
                  pendingLabel="Sending…"
                  doneMessage="A new link is on its way. It expires in 24 hours."
                  variant="outline"
                  size="sm"
                />
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </AuthShell>
  )
}
