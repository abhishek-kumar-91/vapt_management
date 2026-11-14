"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  ActivityIcon,
  BadgeCheckIcon,
  BoxesIcon,
  Building2Icon,
  FlaskConicalIcon,
  LayoutDashboardIcon,
  LogOutIcon,
  type LucideIcon,
  MailIcon,
  SettingsIcon,
  UserPlusIcon,
  UsersIcon,
} from "lucide-react"

import { signOut } from "@/app/login/actions"
import { BrandMark } from "@/components/brand-mark"
import { ThemeToggle } from "@/components/theme-toggle"
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
import { initials } from "@/lib/users"

type Item = { href: string; label: string; icon: LucideIcon; count?: "approvals" | "testing" }

const GROUPS: { label?: string; items: Item[] }[] = [
  {
    items: [
      { href: "/admin", label: "Overview", icon: LayoutDashboardIcon },
      { href: "/admin/approvals", label: "Approvals", icon: BadgeCheckIcon, count: "approvals" },
      { href: "/admin/testing", label: "Testing requests", icon: FlaskConicalIcon, count: "testing" },
    ],
  },
  {
    label: "Platform",
    items: [
      { href: "/admin/companies", label: "Companies", icon: Building2Icon },
      { href: "/admin/signups", label: "Sign-ups", icon: UserPlusIcon },
      { href: "/admin/products", label: "Products", icon: BoxesIcon },
      { href: "/admin/users", label: "Users", icon: UsersIcon },
      { href: "/admin/outbox", label: "Outbox", icon: MailIcon },
      { href: "/admin/audit", label: "Audit log", icon: ActivityIcon },
    ],
  },
]

function Nav({ counts }: { counts: Record<"approvals" | "testing", number> }) {
  const pathname = usePathname()
  const { setOpenMobile } = useSidebar()
  const active = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname.startsWith(href)
  return (
    <SidebarContent>
      {GROUPS.map((group, i) => (
        <SidebarGroup key={i}>
          {group.label && <SidebarGroupLabel>{group.label}</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu>
              {group.items.map((item) => {
                const n = item.count ? counts[item.count] : 0
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={active(item.href)}
                      tooltip={item.label}
                      className="rounded-full"
                    >
                      <Link href={item.href} onClick={() => setOpenMobile(false)}>
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
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      ))}
    </SidebarContent>
  )
}

/** The Super Admin console: same frame as a company console, platform navigation. */
export function AdminShell({
  children,
  user,
  counts,
}: {
  children: React.ReactNode
  user: { name: string; email: string }
  counts: Record<"approvals" | "testing", number>
}) {
  const pathname = usePathname()
  return (
    <SidebarProvider style={{ "--sidebar-width": "17.5rem" } as React.CSSProperties}>
      <Sidebar variant="inset" collapsible="icon">
        <nav aria-label="Admin" className="contents">
          <SidebarHeader>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton size="lg" asChild className="rounded-full">
                  <Link href="/admin">
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
          <Nav counts={counts} />
          <SidebarFooter className="gap-3">
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={pathname.startsWith("/admin/settings")}
                  tooltip="Settings"
                  className="rounded-full"
                >
                  <Link href="/admin/settings">
                    <SettingsIcon />
                    <span>Settings</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <div className="flex items-center gap-2 px-2 py-1.5 group-data-[collapsible=icon]:hidden">
                  <span
                    aria-hidden
                    className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-medium text-primary"
                  >
                    {initials(user.name)}
                  </span>
                  <span className="grid min-w-0 flex-1 leading-tight">
                    <span className="truncate text-sm font-medium">{user.name}</span>
                    <span className="truncate text-xs text-muted-foreground">Super Admin</span>
                  </span>
                  <form action={signOut}>
                    <button
                      type="submit"
                      aria-label="Sign out"
                      className="grid size-8 place-items-center rounded-full text-muted-foreground outline-none hover:bg-sidebar-accent hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/30"
                    >
                      <LogOutIcon className="size-4" />
                    </button>
                  </form>
                </div>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarFooter>
        </nav>
      </Sidebar>
      <SidebarInset className="min-w-0 md:peer-data-[variant=inset]:rounded-3xl md:peer-data-[variant=inset]:shadow-md md:peer-data-[variant=inset]:ring-1 md:peer-data-[variant=inset]:ring-foreground/5">
        <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 rounded-t-3xl border-b bg-background/85 px-3 backdrop-blur-md md:px-5">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mx-1.5 data-vertical:h-4 data-vertical:self-center" />
          <span className="text-sm font-medium">Admin</span>
          <span className="ml-auto truncate text-xs text-muted-foreground">{user.email}</span>
          <ThemeToggle />
        </header>
        <div className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 md:px-8 md:py-8">
          <div key={pathname} className="animate-settle">
            {children}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
