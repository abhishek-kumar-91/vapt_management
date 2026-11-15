"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  ActivityIcon,
  BadgeCheckIcon,
  BoxesIcon,
  Building2Icon,
  FlaskConicalIcon,
  LayoutDashboardIcon,
  type LucideIcon,
  MailIcon,
  SettingsIcon,
  UserPlusIcon,
  UsersIcon,
} from "lucide-react"

import { AppearanceProvider, useAppearance } from "@/components/appearance"
import { BrandMark } from "@/components/brand-mark"
import { AccountMenu } from "@/components/nav-user"
import { ThemeToggle } from "@/components/theme-toggle"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar"
import type { Appearance } from "@/lib/appearance"

type Count = "approvals" | "testing"
type Item = { href: string; label: string; icon: LucideIcon; count?: Count; detail?: string }

const GROUPS: { label?: string; items: Item[] }[] = [
  {
    items: [
      { href: "/admin", label: "Overview", icon: LayoutDashboardIcon },
      { href: "/admin/approvals", label: "Approvals", icon: BadgeCheckIcon, count: "approvals" },
      { href: "/admin/testing", label: "Testing requests", icon: FlaskConicalIcon, count: "testing", detail: "Request" },
    ],
  },
  {
    label: "Platform",
    items: [
      { href: "/admin/companies", label: "Companies", icon: Building2Icon, detail: "Company" },
      { href: "/admin/signups", label: "Sign-ups", icon: UserPlusIcon },
      { href: "/admin/products", label: "Products", icon: BoxesIcon },
      { href: "/admin/users", label: "Users", icon: UsersIcon },
      { href: "/admin/outbox", label: "Outbox", icon: MailIcon },
      { href: "/admin/audit", label: "Audit log", icon: ActivityIcon },
    ],
  },
]
const SETTINGS: Item = { href: "/admin/settings", label: "Settings", icon: SettingsIcon }
const ALL = [...GROUPS.flatMap((g) => g.items), SETTINGS]

const isActive = (pathname: string, href: string) =>
  href === "/admin" ? pathname === "/admin" : pathname.startsWith(href)

function AdminSidebar({
  counts,
  user,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  counts: Record<Count, number>
  user: { name: string; email: string }
}) {
  const pathname = usePathname()
  const { setOpenMobile } = useSidebar()
  const close = () => setOpenMobile(false)
  const link = (item: Item) => {
    const n = item.count ? counts[item.count] : 0
    return (
      <SidebarMenuItem key={item.href}>
        <SidebarMenuButton
          asChild
          isActive={isActive(pathname, item.href)}
          tooltip={item.label}
          className="rounded-full"
        >
          <Link href={item.href} onClick={close}>
            <item.icon />
            <span>{item.label}</span>
            {n > 0 && (
              <span className="ml-auto text-xs font-medium text-muted-foreground tabular group-data-[collapsible=icon]:hidden">
                <span className="sr-only">Waiting: </span>
                {n}
              </span>
            )}
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    )
  }

  return (
    <Sidebar variant="inset" collapsible="icon" {...props}>
      <nav aria-label="Admin" className="contents">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" asChild className="rounded-full">
                <Link href="/admin" onClick={close}>
                  <BrandMark className="size-8!" />
                  <span className="grid leading-tight group-data-[collapsible=icon]:hidden">
                    <span className="font-semibold tracking-tight">Pentest Scout</span>
                    <span className="text-xs text-muted-foreground">Admin console</span>
                  </span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent>
          {GROUPS.map((group, i) => (
            <SidebarGroup key={i}>
              {group.label && <SidebarGroupLabel>{group.label}</SidebarGroupLabel>}
              <SidebarGroupContent>
                <SidebarMenu>{group.items.map(link)}</SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </SidebarContent>
        <SidebarFooter className="gap-3 group-data-[collapsible=icon]:gap-1">
          <SidebarMenu>{link(SETTINGS)}</SidebarMenu>
          <AccountMenu name={user.name} email={user.email} role="Super Admin" />
        </SidebarFooter>
      </nav>
    </Sidebar>
  )
}

function AdminHeader() {
  const pathname = usePathname()
  const section = ALL.filter((i) => isActive(pathname, i.href)).at(-1) ?? ALL[0]
  const deeper = pathname !== section.href && section.href !== "/admin"
  const crumbs = [
    { label: "Admin", href: "/admin" },
    ...(section.href === "/admin" ? [] : [{ label: section.label, href: deeper ? section.href : undefined }]),
    ...(deeper ? [{ label: section.detail ?? "Details" }] : []),
  ]
  return (
    <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 rounded-t-3xl border-b bg-background/85 px-3 backdrop-blur-md md:px-5">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mx-1.5 data-vertical:h-4 data-vertical:self-center" />
      <Breadcrumb className="min-w-0">
        <BreadcrumbList className="flex-nowrap">
          {crumbs.map((crumb, index) => (
            <React.Fragment key={crumb.label}>
              {index > 0 && <BreadcrumbSeparator />}
              <BreadcrumbItem className="min-w-0">
                {crumb.href && index < crumbs.length - 1 ? (
                  <BreadcrumbLink asChild>
                    <Link href={crumb.href}>{crumb.label}</Link>
                  </BreadcrumbLink>
                ) : (
                  <BreadcrumbPage className="truncate font-medium">{crumb.label}</BreadcrumbPage>
                )}
              </BreadcrumbItem>
            </React.Fragment>
          ))}
        </BreadcrumbList>
      </Breadcrumb>
      <div className="ml-auto flex items-center gap-1">
        <ThemeToggle />
      </div>
    </header>
  )
}

function Frame({
  children,
  counts,
  user,
}: {
  children: React.ReactNode
  counts: Record<Count, number>
  user: { name: string; email: string }
}) {
  const { appearance } = useAppearance()
  const pathname = usePathname()
  const darkSidebar = appearance === "dark-sidebar"
  return (
    <SidebarProvider
      data-appearance={appearance}
      className={darkSidebar ? "bg-sidebar-contrast!" : undefined}
      style={{ "--sidebar-width": "17.5rem" } as React.CSSProperties}
    >
      <AdminSidebar counts={counts} user={user} className={darkSidebar ? "dark" : undefined} />
      <SidebarInset className="min-w-0 md:peer-data-[variant=inset]:rounded-3xl md:peer-data-[variant=inset]:shadow-md md:peer-data-[variant=inset]:ring-1 md:peer-data-[variant=inset]:ring-foreground/5">
        <AdminHeader />
        <div className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 md:px-8 md:py-8">
          <div key={pathname} className="animate-settle">
            {children}
          </div>
        </div>
        <footer className="flex flex-wrap justify-between gap-2 px-4 pb-5 text-xs text-muted-foreground md:px-8">
          <span>Pentest Scout admin console</span>
          <span>Every action here is recorded in the audit log</span>
        </footer>
      </SidebarInset>
    </SidebarProvider>
  )
}

/** The Super Admin console: the company console's frame with platform navigation. */
export function AdminShell({
  children,
  user,
  counts,
  initialAppearance,
}: {
  children: React.ReactNode
  user: { name: string; email: string }
  counts: Record<Count, number>
  initialAppearance: Appearance
}) {
  return (
    <AppearanceProvider initial={initialAppearance}>
      <Frame counts={counts} user={user}>
        {children}
      </Frame>
    </AppearanceProvider>
  )
}
