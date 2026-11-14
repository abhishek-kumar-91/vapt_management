"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  CheckIcon,
  KeyRoundIcon,
  LinkIcon,
  LockIcon,
  MinusIcon,
  MoreHorizontalIcon,
  PencilIcon,
  RotateCwIcon,
  SearchIcon,
  UserCheckIcon,
  UserMinusIcon,
  UserPlusIcon,
  UserXIcon,
} from "lucide-react"
import { toast } from "sonner"

import {
  createAccessLinkAction,
  setUserStatusAction,
  updateUserAction,
} from "@/app/dashboard/users/actions"
import { useCurrentUser } from "@/components/current-user"
import { PageHeader } from "@/components/page-header"
import { ToneBadge, type Tone } from "@/components/status"
import {
  AccessLinkDialog,
  type AccessLink,
} from "@/components/users/access-link-dialog"
import { useUsers, useUsersMutation } from "@/components/users/queries"
import { UserFormSheet } from "@/components/users/user-form-sheet"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  STICKY_TOOLBAR,
  useStickyToolbar,
} from "@/components/ui/table"
import { Paginated } from "@/components/ui/table-pagination"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  canManageUser,
  MANAGEABLE_ROLES,
  ROLE_LABELS,
  ROLES,
  roleHas,
  type Role,
} from "@/lib/auth/roles"
import { formatDate, LONG_DATE, toIso } from "@/lib/dates"
import {
  initials,
  PERMISSION_ROWS,
  STATUS_LABELS,
  USER_STATUSES,
  type TeamUser,
  type UserStatus,
} from "@/lib/users"
import { cn } from "@/lib/utils"

const STATUS_TONE: Record<UserStatus, Tone> = {
  active: "success",
  invited: "primary",
  suspended: "neutral",
}

const day = (iso: string | null) =>
  iso ? formatDate(toIso(new Date(iso)), LONG_DATE) : "—"

type Confirm =
  | { kind: "role"; user: TeamUser; role: Role }
  | { kind: "remove"; user: TeamUser }

export default function UsersPage() {
  return (
    <React.Suspense>
      <UsersView />
    </React.Suspense>
  )
}

function UsersView() {
  const router = useRouter()
  const params = useSearchParams()
  const tab = params.get("tab") === "roles" ? "roles" : "members"
  const setTab = (next: string) =>
    router.replace(
      next === "roles" ? "/dashboard/users?tab=roles" : "/dashboard/users",
      { scroll: false }
    )
  const me = useCurrentUser()
  const canView = roleHas(me.role, "user.read")
  const canInvite = MANAGEABLE_ROLES[me.role].length > 0
  const query = useUsers(canView)
  const mutate = useUsersMutation()

  const [view, setView] = React.useState<"all" | UserStatus>("all")
  const [role, setRole] = React.useState<"all" | Role>("all")
  const [search, setSearch] = React.useState("")
  const [sheet, setSheet] = React.useState<{ user?: TeamUser } | null>(null)
  const [confirm, setConfirm] = React.useState<Confirm | null>(null)
  const [link, setLink] = React.useState<AccessLink | null>(null)
  const toolbarRef = useStickyToolbar()

  if (!canView) {
    return (
      <div className="grid gap-6">
        <PageHeader
          title="Users"
          description="Who can use Pentest Scout and what each role is allowed to change."
        />
        <Alert>
          <LockIcon />
          <AlertTitle>No access</AlertTitle>
          <AlertDescription>
            Only Owners and Managers can see the team list. You’re signed in as{" "}
            {ROLE_LABELS[me.role]}.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  const users = query.data ?? []
  const roleOptions = ROLES.filter(
    (r) => r !== "SUPER_ADMIN" || me.role === "SUPER_ADMIN"
  )
  const counts = Object.fromEntries(
    USER_STATUSES.map((s) => [s, users.filter((u) => u.status === s).length])
  ) as Record<UserStatus, number>
  const q = search.trim().toLowerCase()
  const visible = users
    .filter(
      (u) =>
        (view === "all" || u.status === view) &&
        (role === "all" || u.role === role) &&
        (!q || `${u.name} ${u.email}`.toLowerCase().includes(q))
    )
    .sort(
      (a, b) =>
        ROLES.indexOf(a.role) - ROLES.indexOf(b.role) ||
        a.name.localeCompare(b.name)
    )

  const report = (
    result: { ok: true } | { ok: false; error: string },
    success: string
  ) =>
    result.ok
      ? toast.success(success)
      : toast.error("Change not saved", { description: result.error })

  const saveRole = async (user: TeamUser, next: Role) =>
    report(
      await mutate(() =>
        updateUserAction(user.id, {
          name: user.name,
          email: user.email,
          role: next,
        })
      ),
      `${user.name} is now ${ROLE_LABELS[next]}`
    )

  const changeRole = (user: TeamUser, next: Role) => {
    if (next === user.role) return
    if (next === "OWNER") return setConfirm({ kind: "role", user, role: next })
    saveRole(user, next)
  }

  const setStatus = async (user: TeamUser, status: "active" | "suspended") =>
    report(
      await mutate(() => setUserStatusAction(user.id, status)),
      status === "suspended"
        ? `${user.name} is suspended and signed out everywhere`
        : `${user.name} can sign in again`
    )

  const remove = async (user: TeamUser) =>
    report(
      await mutate(() => setUserStatusAction(user.id, "deactivated")),
      user.status === "invited"
        ? `Invite for ${user.name} cancelled`
        : `${user.name} removed and signed out everywhere`
    )

  const accessLink = async (user: TeamUser) => {
    const result = await mutate(() => createAccessLinkAction(user.id))
    if (!result.ok)
      return toast.error("No link created", { description: result.error })
    setLink({ name: user.name, ...result })
  }

  return (
    <div className="grid gap-6">
      <PageHeader
        title="Users"
        description="Who can use Pentest Scout and what each role is allowed to change."
        actions={
          canInvite && (
            <Button onClick={() => setSheet({})}>
              <UserPlusIcon data-icon="inline-start" />
              Invite user
            </Button>
          )
        }
      />

      <Tabs value={tab} onValueChange={setTab} controls="users-panel">
        <TabsList variant="line" className="gap-4">
          <TabsTrigger value="members" className="gap-1.5 px-0">
            Members
            <span className="text-xs text-muted-foreground tabular">
              {users.length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="roles" className="px-0">
            Roles &amp; permissions
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div id="users-panel" className="contents">
        {tab === "roles" ? (
          <PermissionsCard
            users={users}
            roles={roleOptions.filter((r) => r !== "SUPER_ADMIN")}
            onPick={(r) => {
              setRole(r)
              setView("all")
              setSearch("")
              setTab("members")
            }}
          />
        ) : (
          <Card className="animate-settle gap-1 pt-3">
            <CardHeader
              ref={toolbarRef}
              className={cn(
                "flex flex-wrap items-center justify-between gap-3",
                STICKY_TOOLBAR
              )}
            >
              <Tabs
                controls="users-results"
                className="max-w-full overflow-x-auto"
                value={view}
                onValueChange={(v) => setView(v as typeof view)}
              >
                <TabsList>
                  <TabsTrigger value="all" className="gap-1.5">
                    All
                    <span className="text-xs text-muted-foreground tabular">
                      {users.length}
                    </span>
                  </TabsTrigger>
                  {USER_STATUSES.map((s) => (
                    <TabsTrigger key={s} value={s} className="gap-1.5">
                      {s === "invited" ? "Invited" : STATUS_LABELS[s]}
                      <span className="text-xs text-muted-foreground tabular">
                        {counts[s]}
                      </span>
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
              <div className="flex w-full flex-wrap gap-2 sm:w-auto">
                <InputGroup className="w-full sm:w-56">
                  <InputGroupAddon>
                    <SearchIcon />
                  </InputGroupAddon>
                  <InputGroupInput
                    aria-label="Search users"
                    placeholder="Search name or email"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </InputGroup>
                <Select
                  value={role}
                  onValueChange={(v) => setRole(v as typeof role)}
                >
                  <SelectTrigger
                    aria-label="Filter by role"
                    className="w-full sm:w-44"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All roles</SelectItem>
                    {roleOptions.map((r) => (
                      <SelectItem key={r} value={r}>
                        {ROLE_LABELS[r]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent id="users-results" className="px-0">
              {query.isError ? (
                <div className="grid justify-items-center gap-3 px-6 py-12 text-center">
                  <p className="text-muted-foreground">{query.error.message}</p>
                  <Button variant="outline" onClick={() => query.refetch()}>
                    <RotateCwIcon data-icon="inline-start" />
                    Try again
                  </Button>
                </div>
              ) : (
                <Paginated
                  items={visible}
                  resetKey={`${view}|${role}|${q}`}
                  noun="users"
                >
                  {(rows) => (
                    <Table className="min-w-[760px]">
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="pl-6">User</TableHead>
                          <TableHead>Role</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Last sign-in</TableHead>
                          <TableHead className="pr-6 text-right">
                            <span className="sr-only">Actions</span>
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {query.isPending
                          ? [0, 1, 2].map((i) => (
                              <TableRow
                                key={i}
                                className="hover:bg-transparent"
                              >
                                <TableCell className="py-3 pl-6" colSpan={5}>
                                  <div className="flex items-center gap-3">
                                    <Skeleton className="size-9 rounded-full" />
                                    <div className="grid gap-1.5">
                                      <Skeleton className="h-3.5 w-36 rounded-full" />
                                      <Skeleton className="h-3 w-52 rounded-full" />
                                    </div>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))
                          : rows.map((user) => (
                              <UserRow
                                key={user.id}
                                user={user}
                                isSelf={user.id === me.id}
                                editable={canManageUser(me, user)}
                                roles={MANAGEABLE_ROLES[me.role]}
                                onRole={(next) => changeRole(user, next)}
                                onEdit={() => setSheet({ user })}
                                onStatus={(status) => setStatus(user, status)}
                                onLink={() => accessLink(user)}
                                onRemove={() =>
                                  setConfirm({ kind: "remove", user })
                                }
                              />
                            ))}
                        {!query.isPending && !visible.length && (
                          <TableRow className="hover:bg-transparent">
                            <TableCell
                              colSpan={5}
                              className="py-12 text-center text-muted-foreground"
                            >
                              {users.length
                                ? "No users match these filters."
                                : "No users yet. Invite your team to get started."}
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  )}
                </Paginated>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <UserFormSheet
        open={!!sheet}
        onOpenChange={(open) => !open && setSheet(null)}
        user={sheet?.user}
        onInvited={setLink}
      />

      <ConfirmDialog
        confirm={confirm}
        onClose={() => setConfirm(null)}
        onConfirm={(c) => {
          setConfirm(null)
          if (c.kind === "remove") remove(c.user)
          else saveRole(c.user, c.role)
        }}
      />

      <AccessLinkDialog value={link} onClose={() => setLink(null)} />
    </div>
  )
}

function UserRow({
  user,
  isSelf,
  editable,
  roles,
  onRole,
  onEdit,
  onStatus,
  onLink,
  onRemove,
}: {
  user: TeamUser
  isSelf: boolean
  editable: boolean
  roles: readonly Role[]
  onRole: (role: Role) => void
  onEdit: () => void
  onStatus: (status: "active" | "suspended") => void
  onLink: () => void
  onRemove: () => void
}) {
  const suspended = user.status === "suspended"
  return (
    <TableRow className={cn(suspended && "text-muted-foreground")}>
      <TableCell className="py-3 pl-6">
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className={cn(
              "grid size-9 shrink-0 place-items-center rounded-full text-xs font-semibold tracking-tight",
              suspended
                ? "bg-muted text-muted-foreground"
                : "bg-primary/10 text-primary dark:bg-primary/20"
            )}
          >
            {initials(user.name)}
          </span>
          <div className="grid min-w-0 gap-0.5">
            <span className="flex items-center gap-2">
              <span
                className={cn(
                  "truncate font-medium",
                  !suspended && "text-foreground"
                )}
              >
                {user.name}
              </span>
              {isSelf && <ToneBadge tone="neutral">You</ToneBadge>}
            </span>
            <span className="truncate text-xs text-muted-foreground">
              {user.email}
            </span>
          </div>
        </div>
      </TableCell>
      <TableCell className="py-3">
        {editable ? (
          <Select value={user.role} onValueChange={(v) => onRole(v as Role)}>
            <SelectTrigger
              size="sm"
              aria-label={`Role for ${user.name}`}
              className="w-40"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {roles.map((r) => (
                <SelectItem key={r} value={r}>
                  {ROLE_LABELS[r]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <span className="text-sm">{ROLE_LABELS[user.role]}</span>
        )}
      </TableCell>
      <TableCell className="py-3">
        <ToneBadge tone={STATUS_TONE[user.status]} dot>
          {STATUS_LABELS[user.status]}
        </ToneBadge>
      </TableCell>
      <TableCell className="py-3 text-sm text-muted-foreground tabular">
        {user.status === "invited"
          ? `Invited ${day(user.createdAt)}`
          : user.lastLoginAt
            ? day(user.lastLoginAt)
            : "Never"}
      </TableCell>
      <TableCell className="py-3 pr-6 text-right">
        {editable && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label={`Manage ${user.name}`}
              >
                <MoreHorizontalIcon />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onSelect={onEdit}>
                <PencilIcon />
                Edit details
              </DropdownMenuItem>
              {user.status === "invited" && (
                <DropdownMenuItem onSelect={onLink}>
                  <LinkIcon />
                  New invite link
                </DropdownMenuItem>
              )}
              {user.status === "active" && (
                <DropdownMenuItem onSelect={onLink}>
                  <KeyRoundIcon />
                  Password reset link
                </DropdownMenuItem>
              )}
              {user.status === "active" && (
                <DropdownMenuItem onSelect={() => onStatus("suspended")}>
                  <UserXIcon />
                  Suspend access
                </DropdownMenuItem>
              )}
              {suspended && (
                <DropdownMenuItem onSelect={() => onStatus("active")}>
                  <UserCheckIcon />
                  Reactivate access
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={onRemove}>
                <UserMinusIcon />
                {user.status === "invited" ? "Cancel invite…" : "Remove user…"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </TableCell>
    </TableRow>
  )
}

function ConfirmDialog({
  confirm,
  onClose,
  onConfirm,
}: {
  confirm: Confirm | null
  onClose: () => void
  onConfirm: (confirm: Confirm) => void
}) {
  // Keep the last content while the dialog animates closed.
  const [shown, setShown] = React.useState(confirm)
  if (confirm && confirm !== shown) setShown(confirm)
  const c = confirm ?? shown
  if (!c) return null

  const copy =
    c.kind === "remove"
      ? {
          title:
            c.user.status === "invited"
              ? `Cancel ${c.user.name}’s invite?`
              : `Remove ${c.user.name}?`,
          body: `${c.user.email} loses ${ROLE_LABELS[c.user.role]} access straight away and is signed out everywhere. Their past activity stays in the audit log. You can invite them again later.`,
          action: c.user.status === "invited" ? "Cancel invite" : "Remove user",
          destructive: true,
        }
      : {
          title: `Make ${c.user.name} an Owner?`,
          body: "Owners can invite and remove users, change anyone’s role (including other Owners) and change workspace settings.",
          action: "Make Owner",
          destructive: false,
        }

  return (
    <AlertDialog open={!!confirm} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{copy.title}</AlertDialogTitle>
          <AlertDialogDescription>{copy.body}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep as is</AlertDialogCancel>
          <AlertDialogAction
            variant={copy.destructive ? "destructive" : "default"}
            onClick={() => onConfirm(c)}
          >
            {copy.action}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function PermissionsCard({
  users,
  roles,
  onPick,
}: {
  users: TeamUser[]
  roles: Role[]
  /** Show the members who hold this role. */
  onPick: (role: Role) => void
}) {
  const members = (role: Role) =>
    users.filter((u) => u.role === role && u.status !== "suspended").length
  return (
    <Card className="animate-settle gap-4">
      <CardHeader>
        <CardTitle>What each role can do</CardTitle>
        <CardDescription>
          Roles are fixed. Pick the smallest one that covers someone’s work.
          Suspended users aren’t counted.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-0">
        <Table className="min-w-[680px]">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-6">Permission</TableHead>
              {roles.map((r) => (
                <TableHead key={r} className="w-32 text-center last:pr-6">
                  <span className="grid leading-tight">
                    <span className="text-foreground">{ROLE_LABELS[r]}</span>
                    <button
                      type="button"
                      onClick={() => onPick(r)}
                      aria-label={`Show ${ROLE_LABELS[r]} members`}
                      className="mx-auto rounded-full px-1.5 text-xs font-normal text-muted-foreground tabular underline-offset-4 outline-none hover:text-foreground hover:underline focus-visible:ring-3 focus-visible:ring-ring/30"
                    >
                      {members(r)} {members(r) === 1 ? "person" : "people"}
                    </button>
                  </span>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {PERMISSION_ROWS.map((p) => (
              <TableRow key={p.label} className="hover:bg-transparent">
                <TableCell className="py-3 pl-6 whitespace-normal">
                  {p.label}
                </TableCell>
                {roles.map((r) => {
                  const allowed = roleHas(r, p.permission)
                  return (
                    <TableCell key={r} className="py-3 text-center last:pr-6">
                      {allowed ? (
                        <CheckIcon
                          className="mx-auto size-4 text-primary"
                          strokeWidth={2.5}
                        />
                      ) : (
                        <MinusIcon className="mx-auto size-4 text-muted-foreground/50" />
                      )}
                      <span className="sr-only">
                        {allowed ? "Allowed" : "Not allowed"}
                      </span>
                    </TableCell>
                  )
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
