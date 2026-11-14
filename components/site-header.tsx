"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  DownloadIcon,
  LogOutIcon,
  RotateCcwIcon,
  UsersIcon,
} from "lucide-react"

import { signOut } from "@/app/login/actions"
import { useCurrentUser } from "@/components/current-user"
import { ThemeToggle } from "@/components/theme-toggle"

import { NAV_ITEMS } from "@/components/app-sidebar"
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { ROLE_LABELS, roleHas } from "@/lib/auth/roles"
import { useDashboard } from "@/lib/store"
import { initials } from "@/lib/users"

function useCrumbs() {
  const pathname = usePathname()
  const { data } = useDashboard()
  const product = /^\/dashboard\/products\/([^/]+)/.exec(pathname)?.[1]
  if (product) {
    return [
      { label: "Overview", href: "/dashboard" },
      { label: data.products[decodeURIComponent(product)]?.name ?? "Product" },
    ]
  }
  const item = NAV_ITEMS.find((nav) =>
    nav.href === "/dashboard"
      ? pathname === "/dashboard"
      : pathname.startsWith(nav.href)
  )
  return [{ label: item?.label ?? "Overview" }]
}

export function SiteHeader() {
  const crumbs = useCrumbs()
  const { actions } = useDashboard()
  const user = useCurrentUser()
  const [confirmReset, setConfirmReset] = React.useState(false)
  const [signingOut, startSignOut] = React.useTransition()

  return (
    <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 rounded-t-3xl border-b bg-background/85 px-3 backdrop-blur-md md:px-5">
      <SidebarTrigger className="-ml-1" />
      <Separator
        orientation="vertical"
        className="mx-1.5 data-vertical:h-4 data-vertical:self-center"
      />
      <Breadcrumb className="min-w-0">
        <BreadcrumbList className="flex-nowrap">
          {crumbs.map((crumb, index) => (
            <React.Fragment key={crumb.label}>
              {index > 0 && <BreadcrumbSeparator />}
              <BreadcrumbItem className="min-w-0">
                {crumb.href ? (
                  <BreadcrumbLink asChild>
                    <Link href={crumb.href}>{crumb.label}</Link>
                  </BreadcrumbLink>
                ) : (
                  <BreadcrumbPage className="truncate font-medium">
                    {crumb.label}
                  </BreadcrumbPage>
                )}
              </BreadcrumbItem>
            </React.Fragment>
          ))}
        </BreadcrumbList>
      </Breadcrumb>

      <div className="ml-auto flex items-center gap-1">
        <ThemeToggle />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full"
              aria-label="Account and data"
            >
              <Avatar className="size-8">
                <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                  {initials(user.name)}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuLabel className="grid font-normal">
              <span className="truncate font-medium text-foreground">
                {user.name}
              </span>
              <span className="truncate text-xs text-muted-foreground">
                {ROLE_LABELS[user.role]} · {user.email}
              </span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              {roleHas(user.role, "user.read") && (
                <DropdownMenuItem asChild>
                  <Link href="/dashboard/users">
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
      </div>

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
    </header>
  )
}
