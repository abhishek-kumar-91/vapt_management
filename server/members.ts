import "server-only"

import { and, asc, eq, ne, sql } from "drizzle-orm"

import { memberships, users } from "@/db/schema"
import type { Tx } from "@/lib/auth/audit"
import {
  canManageUser,
  isOrgRole,
  ROLE_LABELS,
  roleHas,
  type OrgRole,
} from "@/lib/auth/roles"
import { revokeUserSessions } from "@/lib/auth/session"
import { cancelTokens, issueToken, TOKEN_TTL_H } from "@/lib/auth/tokens"
import { appUrl, sendEmail } from "@/lib/email/send"
import { EMAIL_PATTERN } from "@/lib/auth/shared"
import type { TeamUser } from "@/lib/users"

import { auditAs, withOrg, type Ctx } from "./context"
import { refreshOrgStats } from "./stats"

/** Team data access for one company. Every function checks the caller's permission and audits. */

export type Result<T = object> =
  ({ ok: true } & T) | { ok: false; error: string }

const NOT_ALLOWED = "You don’t have permission to do that."
const UNAVAILABLE = "That didn’t save. Check your connection and try again."
const LAST_OWNER = "A company needs at least one active Owner."

const INVITE_TTL_H = TOKEN_TTL_H.org_invite
const RESET_TTL_H = TOKEN_TTL_H.password_reset

const pgCode = (error: unknown) =>
  (error as { code?: string })?.code ??
  (error as { cause?: { code?: string } })?.cause?.code
const pgConstraint = (error: unknown) =>
  (error as { constraint?: string })?.constraint ??
  (error as { cause?: { constraint?: string } })?.cause?.constraint

function failure(error: unknown, label: string): Result {
  if (pgConstraint(error) === "memberships_keep_an_owner")
    return { ok: false, error: LAST_OWNER }
  if (pgCode(error) === "23505")
    return { ok: false, error: "Someone with this email already has access." }
  console.error(label, error)
  return { ok: false, error: UNAVAILABLE }
}

const member = {
  id: users.id,
  name: users.name,
  email: users.email,
  userStatus: users.status,
  role: memberships.role,
  status: memberships.status,
  createdAt: memberships.createdAt,
  lastLoginAt: users.lastLoginAt,
}

/** Everyone in this company except removed members. */
export async function listMembers(
  ctx: Ctx
): Promise<Result<{ users: TeamUser[] }>> {
  if (!roleHas(ctx.role, "member.read")) return { ok: false, error: NOT_ALLOWED }
  const rows = await withOrg(ctx, (tx) =>
    tx
      .select(member)
      .from(memberships)
      .innerJoin(users, eq(users.id, memberships.userId))
      .where(
        and(eq(memberships.orgId, ctx.org.id), ne(memberships.status, "removed"))
      )
      .orderBy(asc(users.name))
  )
  return {
    ok: true,
    users: rows.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      status: u.status as TeamUser["status"],
      createdAt: u.createdAt.toISOString(),
      lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
    })),
  }
}

const linkFor = (path: "set-password" | "invite", token: string) =>
  appUrl(`/${path}/${token}`)

function parseDetails(input: { name?: unknown; email?: unknown; role?: unknown }) {
  const name = String(input.name ?? "")
    .trim()
    .slice(0, 120)
  const email = String(input.email ?? "")
    .trim()
    .toLowerCase()
  if (!name) return { error: "Enter their full name." }
  if (!EMAIL_PATTERN.test(email) || email.length > 254)
    return { error: "Enter a valid work email, like name@company.com." }
  if (!isOrgRole(input.role)) return { error: "Choose a role." }
  return { name, email, role: input.role }
}

/**
 * Invite someone to this company. A new email gets an account waiting for a password; an
 * existing account gets a pending membership it accepts on /invite (phase 3).
 */
export async function inviteMember(
  ctx: Ctx,
  input: { name?: unknown; email?: unknown; role?: unknown }
): Promise<Result<{ link: string; expiresInHours: number }>> {
  const details = parseDetails(input)
  if ("error" in details) return { ok: false, error: details.error! }
  const me = { id: ctx.user.id, role: ctx.role }
  if (!canManageUser(me, { id: "", role: details.role }, details.role))
    return { ok: false, error: NOT_ALLOWED }

  try {
    const result = await withOrg(ctx, async (tx) => {
      let [user] = await tx
        .select({
          id: users.id,
          status: users.status,
          hasPassword: sql<boolean>`${users.passwordHash} is not null`,
        })
        .from(users)
        .where(eq(users.email, details.email))
        .for("update")
      if (user?.status === "disabled")
        return { error: "This account is disabled. Contact Pentest Scout support." }

      if (user) {
        const [existing] = await tx
          .select({ status: memberships.status })
          .from(memberships)
          .where(
            and(
              eq(memberships.orgId, ctx.org.id),
              eq(memberships.userId, user.id)
            )
          )
        if (existing && existing.status !== "removed")
          return { error: "Someone with this email already has access." }
      } else {
        ;[user] = await tx
          .insert(users)
          .values({ name: details.name, email: details.email, status: "invited" })
          .returning({
            id: users.id,
            status: users.status,
            hasPassword: sql<boolean>`false`,
          })
      }

      // A removed member can be invited again: reuse the row so their history stays linked.
      await tx
        .insert(memberships)
        .values({
          orgId: ctx.org.id,
          userId: user.id,
          role: details.role,
          status: "invited",
          invitedBy: ctx.user.id,
        })
        .onConflictDoUpdate({
          target: [memberships.orgId, memberships.userId],
          set: {
            role: details.role,
            status: "invited",
            invitedBy: ctx.user.id,
            joinedAt: null,
          },
        })
      await auditAs(
        ctx,
        {
          action: "member.invited",
          outcome: "success",
          entityType: "user",
          entityId: user.id,
          changes: { role: [null, details.role] },
        },
        tx
      )
      const issued = await issueToken(tx, {
        userId: user.id,
        purpose: "org_invite",
        createdBy: ctx.user.id,
        orgId: ctx.org.id,
      })
      const path = user.hasPassword ? "invite" : "set-password"
      const link = await linkFor(path, issued.token)
      await sendEmail(tx, {
        to: details.email,
        template: "org_invite",
        data: {
          inviter: ctx.user.name,
          orgName: ctx.org.name,
          role: ROLE_LABELS[details.role],
          link,
        },
        orgId: ctx.org.id,
        userId: user.id,
        link,
        tokenId: issued.tokenId,
        expiresAt: issued.expiresAt,
      })
      return { link }
    })
    if ("error" in result) return { ok: false, error: result.error! }
    return { ok: true, link: result.link, expiresInHours: INVITE_TTL_H }
  } catch (error) {
    return failure(error, "invite member failed") as Result<never>
  }
}

/** Lock the target's membership and check the caller may manage it (and move it to nextRole). */
async function target(tx: Tx, ctx: Ctx, userId: string, nextRole?: OrgRole) {
  const [row] = await tx
    .select(member)
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(and(eq(memberships.orgId, ctx.org.id), eq(memberships.userId, userId)))
    .for("update", { of: memberships })
  if (!row || row.status === "removed") return null
  return canManageUser({ id: ctx.user.id, role: ctx.role }, row, nextRole)
    ? row
    : null
}

/** Active memberships this person holds in other companies (a SECURITY DEFINER count; see 0001_guards.sql). */
async function otherCompanies(tx: Tx, ctx: Ctx, userId: string) {
  const { rows } = await tx.execute<{ n: number }>(
    sql`select active_memberships_elsewhere(${userId}, ${ctx.org.id}) as n`
  )
  return rows[0]?.n ?? 0
}

/**
 * Change a member's role. Name and email belong to the person, so they can only be corrected
 * here while the invite is still pending and this is their only company.
 */
export async function updateMember(
  ctx: Ctx,
  userId: string,
  input: { name?: unknown; email?: unknown; role?: unknown }
): Promise<Result> {
  const details = parseDetails(input)
  if ("error" in details) return { ok: false, error: details.error! }
  try {
    return await withOrg(ctx, async (tx): Promise<Result> => {
      const before = await target(tx, ctx, userId, details.role)
      if (!before) return { ok: false, error: NOT_ALLOWED }
      const identityChanged =
        before.name !== details.name || before.email !== details.email
      if (identityChanged) {
        if (before.userStatus !== "invited" || (await otherCompanies(tx, ctx, userId)))
          return {
            ok: false,
            error: "Only they can change their name or email once they’ve joined.",
          }
        await tx
          .update(users)
          .set({ name: details.name, email: details.email })
          .where(eq(users.id, userId))
      }
      if (before.role !== details.role)
        await tx
          .update(memberships)
          .set({ role: details.role })
          .where(and(eq(memberships.orgId, ctx.org.id), eq(memberships.userId, userId)))
      const changes = Object.fromEntries(
        (["name", "email", "role"] as const)
          .filter((key) => before[key] !== details[key])
          .map((key) => [key, [before[key], details[key]]])
      ) as Record<string, [unknown, unknown]>
      if (!Object.keys(changes).length) return { ok: true }
      await auditAs(
        ctx,
        {
          action: changes.role ? "member.role_changed" : "member.updated",
          outcome: "success",
          entityType: "user",
          entityId: userId,
          changes,
        },
        tx
      )
      return { ok: true }
    })
  } catch (error) {
    return failure(error, "update member failed")
  }
}

/**
 * Suspend, reactivate, or remove a member. Suspension and removal cancel their invite links for
 * this company and sign them out, unless they still have access to another company.
 */
export async function setMemberStatus(
  ctx: Ctx,
  userId: string,
  next: "active" | "suspended" | "removed"
): Promise<Result> {
  try {
    return await withOrg(ctx, async (tx): Promise<Result> => {
      const before = await target(tx, ctx, userId)
      if (!before) return { ok: false, error: NOT_ALLOWED }
      if (next === "active" && before.status !== "suspended")
        return { ok: false, error: "Only suspended members can be reactivated." }
      if (next === "suspended" && before.status !== "active")
        return { ok: false, error: "Only active members can be suspended." }
      await tx
        .update(memberships)
        .set({ status: next })
        .where(and(eq(memberships.orgId, ctx.org.id), eq(memberships.userId, userId)))
      if (next !== "active") {
        await cancelTokens(tx, userId, ctx.org.id)
        if (!(await otherCompanies(tx, ctx, userId)))
          await revokeUserSessions(tx, userId)
      }
      await refreshOrgStats(tx, ctx.org.id)
      await auditAs(
        ctx,
        {
          action: `member.${next === "active" ? "reactivated" : next}`,
          outcome: "success",
          entityType: "user",
          entityId: userId,
          changes: { status: [before.status, next] },
        },
        tx
      )
      return { ok: true }
    })
  } catch (error) {
    return failure(error, "set member status failed")
  }
}

/**
 * A new invite link for a pending member, or a password reset link for an active one. Resetting
 * someone who also belongs to another company isn't this company's call.
 */
export async function createAccessLink(
  ctx: Ctx,
  userId: string
): Promise<
  Result<{
    link: string
    purpose: "invite" | "password_reset"
    expiresInHours: number
  }>
> {
  try {
    const result = await withOrg(ctx, async (tx) => {
      const user = await target(tx, ctx, userId)
      if (!user || user.status === "suspended") return { error: NOT_ALLOWED }
      const invite = user.status === "invited"
      if (!invite && (await otherCompanies(tx, ctx, userId)))
        return {
          error:
            "They also belong to another company, so only they can reset their password from the sign-in page.",
        }
      const issued = await issueToken(tx, {
        userId,
        purpose: invite ? "org_invite" : "password_reset",
        createdBy: ctx.user.id,
        orgId: invite ? ctx.org.id : null,
      })
      const link = await linkFor(
        invite && user.userStatus !== "invited" ? "invite" : "set-password",
        issued.token
      )
      await sendEmail(tx, {
        to: user.email,
        ...(invite
          ? {
              template: "org_invite" as const,
              data: {
                inviter: ctx.user.name,
                orgName: ctx.org.name,
                role: ROLE_LABELS[user.role],
                link,
              },
            }
          : {
              template: "password_reset" as const,
              data: { name: user.name, link },
            }),
        orgId: ctx.org.id,
        userId,
        link,
        tokenId: issued.tokenId,
        expiresAt: issued.expiresAt,
      })
      await auditAs(
        ctx,
        {
          action: invite ? "member.invite_link_created" : "member.reset_link_created",
          outcome: "success",
          entityType: "user",
          entityId: userId,
        },
        tx
      )
      return { link, purpose: invite ? ("invite" as const) : ("password_reset" as const) }
    })
    if ("error" in result) return { ok: false, error: result.error! }
    return {
      ok: true,
      purpose: result.purpose,
      link: result.link,
      expiresInHours: result.purpose === "invite" ? INVITE_TTL_H : RESET_TTL_H,
    }
  } catch (error) {
    return failure(error, "create access link failed") as Result<never>
  }
}
