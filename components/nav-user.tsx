"use client"

import * as React from "react"
import Link from "next/link"
import {
  ChevronsUpDownIcon,
  DownloadIcon,
  LogOutIcon,
  RotateCcwIcon,
  UsersIcon,
} from "lucide-react"

import { signOut } from "@/app/login/actions"
import { useCurrentUser } from "@/components/current-user"
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { ROLE_LABELS, roleHas } from "@/lib/auth/roles"
import { useDashboard } from "@/lib/store"
import { initials } from "@/lib/users"

function UserAvatar({ name }: { name: string }) {
  return (
    <span
      aria-hidden
      className="grid size-8 shrink-0 place-items-center rounded-full bg-sidebar-primary text-xs font-semibold tracking-tight text-sidebar-primary-foreground"
    >
      {initials(name)}
    </span>
  )
}

/** Sidebar foot: who is signed in, their role, and the account menu. */
export function NavUser() {
  const user = useCurrentUser()
  const { actions } = useDashboard()
  const { isMobile, setOpenMobile } = useSidebar()
  const [confirmReset, setConfirmReset] = React.useState(false)
  const [signingOut, startSignOut] = React.useTransition()
  const role = ROLE_LABELS[user.role]

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              tooltip={`${user.name} · ${role}`}
              className="h-14 rounded-3xl bg-card px-2.5 shadow-xs ring-1 ring-sidebar-border transition-[background-color,box-shadow] hover:bg-sidebar-accent hover:ring-foreground/15 data-[state=open]:bg-sidebar-accent data-[state=open]:ring-foreground/15 group-data-[collapsible=icon]:bg-transparent group-data-[collapsible=icon]:p-0! group-data-[collapsible=icon]:shadow-none group-data-[collapsible=icon]:ring-0"
            >
              <UserAvatar name={user.name} />
              <span className="grid min-w-0 flex-1 leading-tight">
                <span className="truncate text-sm font-medium">
                  {user.name}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {role}
                </span>
              </span>
              <ChevronsUpDownIcon className="ml-auto size-4 text-muted-foreground" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side={isMobile ? "top" : "right"}
            align="end"
            sideOffset={8}
            className="w-64"
          >
            <DropdownMenuLabel className="flex items-center gap-3 py-2 font-normal">
              <UserAvatar name={user.name} />
              <span className="grid min-w-0 leading-tight">
                <span className="truncate font-medium text-foreground">
                  {user.name}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {user.email}
                </span>
                <span className="mt-1 w-fit rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-foreground">
                  {role}
                </span>
              </span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              {roleHas(user.role, "user.read") && (
                <DropdownMenuItem asChild>
                  <Link
                    href="/dashboard/users"
                    onClick={() => setOpenMobile(false)}
                  >
                    <UsersIcon />
                    Manage users
                  </Link>
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onSelect={actions.exportData}>
                <DownloadIcon />
                Export JSON
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                onSelect={() => setConfirmReset(true)}
              >
                <RotateCcwIcon />
                Reset local data…
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              disabled={signingOut}
              onSelect={() => startSignOut(() => signOut())}
            >
              <LogOutIcon />
              {signingOut ? "Signing out…" : "Sign out"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>

      <AlertDialog open={confirmReset} onOpenChange={setConfirmReset}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset local data?</AlertDialogTitle>
            <AlertDialogDescription>
              This discards every local edit in this browser (test areas,
              findings, cycle dates and saved reports) and restores the bundled
              starting data. Export JSON first if you want to keep a copy.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={actions.resetData}
            >
              Reset data
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SidebarMenu>
  )
}
