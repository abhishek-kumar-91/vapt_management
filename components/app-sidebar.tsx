"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  ActivityIcon,
  BellIcon,
  FileTextIcon,
  LayoutDashboardIcon,
  type LucideIcon,
  SettingsIcon,
  ShieldAlertIcon,
  UsersIcon,
} from "lucide-react"

import { BrandMark } from "@/components/brand-mark"
import { useCan } from "@/components/current-user"
import { NavUser } from "@/components/nav-user"
import { ProductAvatar } from "@/components/product-avatar"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { useDashboard } from "@/lib/store"
import { isClosed, metricsFor } from "@/lib/metrics"
import { cn } from "@/lib/utils"

export const NAV_ITEMS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboardIcon },
  { href: "/dashboard/findings", label: "Findings", icon: ShieldAlertIcon },
  { href: "/dashboard/reports", label: "Reports", icon: FileTextIcon },
  { href: "/dashboard/activity", label: "Activity log", icon: ActivityIcon },
  { href: "/dashboard/users", label: "Users", icon: UsersIcon },
]

/** Pinned to the sidebar foot, just above the signed-in user. */
export const SETTINGS_ITEM = {
  href: "/dashboard/settings",
  label: "Settings",
  icon: SettingsIcon,
}

/** Every top-level page: breadcrumbs and global search read from this. */
export const PAGES = [
  ...NAV_ITEMS,
  {
    href: "/dashboard/notifications",
    label: "Notifications",
    icon: BellIcon,
  },
  SETTINGS_ITEM,
]

const HEALTH_DOT = {
  Green: "bg-success",
  Amber: "bg-warning",
  Red: "bg-critical",
  Paused: "bg-paused",
  "Not started": "bg-muted-foreground/40",
} as const

export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname()
  const { products, findings, hydrated } = useDashboard()
  const { setOpenMobile } = useSidebar()
  const canSeeUsers = useCan("user.read")
  const navItems = NAV_ITEMS.filter(
    (item) => item.href !== "/dashboard/users" || canSeeUsers
  )
  const openCount = findings.filter((finding) => !isClosed(finding)).length
  const isActive = (href: string) =>
    href === "/dashboard"
      ? pathname === "/dashboard"
      : pathname.startsWith(href)
  const close = () => setOpenMobile(false)

  return (
    <Sidebar variant="inset" collapsible="icon" {...props}>
      <nav aria-label="Main" className="contents">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" asChild className="rounded-full">
                <Link href="/dashboard" onClick={close}>
                  <BrandMark className="size-8!" />
                  <span className="grid leading-tight group-data-[collapsible=icon]:hidden">
                    <span className="font-semibold tracking-tight">
                      Pentest Scout
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Security console
                    </span>
                  </span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {navItems.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive(item.href)}
                      tooltip={item.label}
                      className="rounded-full"
                    >
                      <Link href={item.href} onClick={close}>
                        <item.icon />
                        <span>{item.label}</span>
                        {item.href === "/dashboard/findings" &&
                          hydrated &&
                          openCount > 0 && (
                            <span className="ml-auto text-xs font-medium text-muted-foreground tabular group-data-[collapsible=icon]:hidden">
                              <span className="sr-only">Open findings: </span>
                              {openCount}
                            </span>
                          )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          <SidebarGroup>
            <SidebarGroupLabel>Products</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {products.map((product) => {
                  const health = metricsFor(product, findings).health
                  const href = `/dashboard/products/${product.id}`
                  return (
                    <SidebarMenuItem key={product.id}>
                      <SidebarMenuButton
                        asChild
                        isActive={pathname === href}
                        tooltip={product.name}
                        className="rounded-full group-data-[collapsible=icon]:p-1!"
                      >
                        <Link href={href} onClick={close}>
                          <ProductAvatar
                            id={product.id}
                            name={product.name}
                            className="-ml-1 size-6 text-xs group-data-[collapsible=icon]:ml-0"
                          />
                          <span className="truncate">{product.name}</span>
                          <span className="ml-auto inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
                            <span
                              aria-hidden
                              className={cn(
                                "size-2 rounded-full",
                                HEALTH_DOT[health]
                              )}
                            />
                            <span className="sr-only">Health </span>
                            {health === "Not started" ? "New" : health}
                          </span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter className="gap-3 group-data-[collapsible=icon]:gap-1">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={isActive(SETTINGS_ITEM.href)}
                tooltip={SETTINGS_ITEM.label}
                className="rounded-full"
              >
                <Link href={SETTINGS_ITEM.href} onClick={close}>
                  <SETTINGS_ITEM.icon />
                  <span>{SETTINGS_ITEM.label}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
          <NavUser />
        </SidebarFooter>
      </nav>
    </Sidebar>
  )
}
