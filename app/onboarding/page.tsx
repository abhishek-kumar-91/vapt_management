import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { and, asc, eq, isNull, sql } from "drizzle-orm"
import { CircleAlertIcon, ClockIcon, MailIcon } from "lucide-react"

import { resendVerification } from "@/app/actions/account"
import { signOut } from "@/app/login/actions"
import { ActionButton } from "@/components/auth/action-button"
import { AuthHeading, AuthShell } from "@/components/auth/auth-shell"
import { ActionForm, type FieldSpec } from "@/components/forms/action-form"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { organizations, products, users } from "@/db/schema"
import { getSession } from "@/lib/auth/session"
import { formatDate } from "@/lib/dates"
import { COMPANY_SIZES, DATA_SENSITIVITY, INDUSTRIES } from "@/lib/orgs"
import { findOnboardingOrg, listMyOrgs, withScope } from "@/server/context"

import {
  addProductAction,
  createCompanyAction,
  removeProductAction,
  submitAction,
  updateCompanyAction,
} from "./actions"

export const metadata: Metadata = { title: "Set up your company" }

const options = (values: readonly string[], placeholder: string) => [
  { value: "", label: placeholder },
  ...values.map((v) => ({ value: v, label: v })),
]

const profileFields = (defaults?: Record<string, string>): FieldSpec[] => [
  {
    name: "name",
    label: "Company name",
    autoComplete: "organization",
    maxLength: 80,
    defaultValue: defaults?.name,
  },
  {
    name: "industry",
    label: "Industry",
    type: "select",
    options: options(INDUSTRIES, "Choose one"),
    half: true,
    defaultValue: defaults?.industry,
  },
  {
    name: "size",
    label: "Company size",
    type: "select",
    options: options(COMPANY_SIZES, "Choose one"),
    half: true,
    defaultValue: defaults?.size,
  },
  {
    name: "website",
    label: "Website (optional)",
    type: "url",
    placeholder: "company.com",
    maxLength: 200,
    defaultValue: defaults?.website,
  },
]

const productFields: FieldSpec[] = [
  {
    name: "name",
    label: "Product name",
    maxLength: 80,
    placeholder: "Customer web app",
  },
  {
    name: "tier",
    label: "Tier",
    type: "select",
    half: true,
    options: [
      { value: "1", label: "Tier 1 · business-critical" },
      { value: "2", label: "Tier 2 · important" },
      { value: "3", label: "Tier 3 · standard" },
    ],
    description:
      "Tier sets how often it’s retested and which test areas it starts with.",
  },
  {
    name: "dataSensitivity",
    label: "Data sensitivity",
    type: "select",
    half: true,
    options: options(DATA_SENSITIVITY, "Not sure yet"),
  },
  {
    name: "domain",
    label: "Domain or URL (optional)",
    placeholder: "app.company.com",
    half: true,
  },
  {
    name: "technology",
    label: "Technology (optional)",
    placeholder: "Next.js, Postgres",
    half: true,
  },
]

function SignOut() {
  return (
    <form action={signOut}>
      <Button type="submit" variant="ghost" size="sm">
        Sign out
      </Button>
    </form>
  )
}

/**
 * Self-serve onboarding: create the company, add products, then submit it for Pentest Scout's
 * review. While waiting (or after a rejection) everything stays editable here.
 */
export default async function OnboardingPage() {
  const session = await getSession()
  if (!session) redirect("/login?next=/onboarding")
  if (session.user.platform) redirect("/admin")

  const pending = await findOnboardingOrg(session.user.id)
  if (!pending) {
    const orgs = await listMyOrgs(session.user.id)
    if (orgs.length) redirect(`/o/${orgs[0].slug}`)
    return (
      <AuthShell wide aside={<SignOut />}>
        <AuthHeading title="Tell us about your company">
          This becomes your company’s workspace on Pentest Scout. You’ll add the
          products to track next.
        </AuthHeading>
        <ActionForm
          action={createCompanyAction}
          submitLabel="Create company"
          pendingLabel="Creating…"
          fields={[
            ...profileFields().slice(0, 1),
            {
              name: "slug",
              label: "Workspace address (optional)",
              placeholder: "acme",
              maxLength: 40,
              description:
                "Lower-case letters, numbers and dashes. Leave blank to use the company name. It can’t change later.",
            },
            ...profileFields().slice(1),
          ]}
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
      db
        .select({ verified: users.emailVerifiedAt })
        .from(users)
        .where(eq(users.id, session.user.id)),
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

  return (
    <AuthShell wide aside={<SignOut />}>
      <AuthHeading
        title={
          waiting ? `${org.name} is waiting for review` : `Set up ${org.name}`
        }
      >
        {waiting
          ? "Pentest Scout reviews every company before it goes live. We’ll email you as soon as it’s approved. You can keep editing below."
          : "Add the products you want to track, then submit your company for review. Pentest Scout approves every company before it goes live."}
      </AuthHeading>

      {waiting && org.submittedAt && (
        <Alert>
          <ClockIcon />
          <AlertTitle>
            Submitted {formatDate(org.submittedAt.toISOString().slice(0, 10))}
          </AlertTitle>
          <AlertDescription>
            Reviews usually take one working day.
          </AlertDescription>
        </Alert>
      )}
      {org.reviewNote && !waiting && (
        <Alert variant={org.status === "rejected" ? "destructive" : "default"}>
          <CircleAlertIcon />
          <AlertTitle>
            {org.status === "rejected"
              ? "Not approved yet"
              : "Changes requested"}
          </AlertTitle>
          <AlertDescription>
            {org.reviewNote} Update the details below, then submit again.
          </AlertDescription>
        </Alert>
      )}
      {!me?.verified && (
        <Alert>
          <MailIcon />
          <AlertTitle>Confirm your email</AlertTitle>
          <AlertDescription className="grid gap-3">
            <span>
              We sent a link to {session.user.email}. You can set everything up
              now, but you need to confirm your email before submitting.
            </span>
            <ActionButton
              action={resendVerification}
              label="Send a new link"
              pendingLabel="Sending…"
              doneMessage="A new link is on its way. It expires in 24 hours."
              variant="outline"
              size="sm"
            />
          </AlertDescription>
        </Alert>
      )}

      <section aria-labelledby="products-heading" className="grid gap-5">
        <div className="grid gap-1">
          <h2
            id="products-heading"
            className="text-xl font-semibold tracking-tight"
          >
            Products to track
          </h2>
          <p className="text-sm text-muted-foreground">
            Each product starts with the standard test areas for its tier. You
            can change them once your company is live.
          </p>
        </div>
        {list.length > 0 && (
          <ul className="grid divide-y rounded-3xl ring-1 ring-foreground/10">
            {list.map((p) => (
              <li key={p.slug} className="flex items-center gap-4 px-5 py-3">
                <div className="grid min-w-0 flex-1">
                  <span className="truncate font-medium">{p.name}</span>
                  <span className="text-sm text-muted-foreground">
                    Tier {p.tier} · {p.areas} test areas
                  </span>
                </div>
                <ActionButton
                  action={removeProductAction.bind(null, p.slug)}
                  label="Remove"
                  pendingLabel="Removing…"
                  variant="ghost"
                  size="sm"
                />
              </li>
            ))}
          </ul>
        )}
        <ActionForm
          action={addProductAction}
          fields={productFields}
          submitLabel={list.length ? "Add another product" : "Add product"}
          pendingLabel="Adding…"
          className="rounded-3xl p-5 ring-1 ring-foreground/10"
        />
      </section>

      <section aria-labelledby="company-heading" className="grid gap-5">
        <div className="grid gap-1">
          <h2
            id="company-heading"
            className="text-xl font-semibold tracking-tight"
          >
            Company details
          </h2>
          <p className="text-sm text-muted-foreground">
            Workspace address:{" "}
            <span className="font-medium text-foreground">/o/{org.slug}</span>
          </p>
        </div>
        <ActionForm
          action={updateCompanyAction}
          submitLabel="Save details"
          pendingLabel="Saving…"
          fields={profileFields({
            name: org.name,
            industry: org.industry ?? "",
            size: org.size ?? "",
            website: org.website ?? "",
          })}
        />
      </section>

      {canSubmit && (
        <section
          aria-labelledby="submit-heading"
          className="grid gap-3 border-t pt-8"
        >
          <h2
            id="submit-heading"
            className="text-xl font-semibold tracking-tight"
          >
            Submit for review
          </h2>
          <p className="text-sm text-pretty text-muted-foreground">
            {!me?.verified
              ? "Confirm your email first; the link is in your inbox."
              : !list.length
                ? "Add at least one product first."
                : "Pentest Scout will review your company and email you when it’s approved."}
          </p>
          <ActionButton
            action={submitAction}
            label={
              org.status === "rejected" ? "Submit again" : "Submit for review"
            }
            pendingLabel="Submitting…"
          />
        </section>
      )}
    </AuthShell>
  )
}
