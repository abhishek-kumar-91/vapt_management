"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  ActivityIcon,
  BoxesIcon,
  FlaskConicalIcon,
  BellIcon,
  FileTextIcon,
  LayoutDashboardIcon,
  type LucideIcon,
  SettingsIcon,
  ShieldAlertIcon,
  UsersIcon,
} from "lucide-react"

import { useCan, useOrgPath } from "@/components/current-user"
import { NavUser } from "@/components/nav-user"
import { OrgSwitcher } from "@/components/org-switcher"
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

/** Paths relative to the company: prefix with useOrgPath(). "" is the overview. */
export const NAV_ITEMS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "", label: "Overview", icon: LayoutDashboardIcon },
  { href: "/products", label: "Products", icon: BoxesIcon },
  { href: "/findings", label: "Findings", icon: ShieldAlertIcon },
  { href: "/reports", label: "Reports", icon: FileTextIcon },
  { href: "/activity", label: "Activity log", icon: ActivityIcon },
  { href: "/testing", label: "Testing", icon: FlaskConicalIcon },
  { href: "/users", label: "Team", icon: UsersIcon },
]

/** Pinned to the sidebar foot, just above the signed-in user. */
export const SETTINGS_ITEM = {
  href: "/settings",
  label: "Settings",
  icon: SettingsIcon,
}

/** Every top-level page: breadcrumbs and global search read from this. */
export const PAGES = [
  ...NAV_ITEMS,
  {
    href: "/notifications",
    label: "Notifications",
    icon: BellIcon,
  },
  SETTINGS_ITEM,
]

/** Past this many, the sidebar links to the Products page instead of listing them all. */
const SIDEBAR_PRODUCTS = 8

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
  const canSeeUsers = useCan("member.read")
  const to = useOrgPath()
  const canRequestTesting = useCan("testing.request")
  const navItems = NAV_ITEMS.filter(
    (item) =>
      (item.href !== "/users" || canSeeUsers) &&
      (item.href !== "/testing" || canRequestTesting)
  )
  const openCount = findings.filter((finding) => !isClosed(finding)).length
  const isActive = (href: string) =>
    href === "" || href === "/products"
      ? pathname === to(href)
      : pathname.startsWith(to(href))
  const close = () => setOpenMobile(false)

  return (
    <Sidebar variant="inset" collapsible="icon" {...props}>
      <nav aria-label="Main" className="contents">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <OrgSwitcher />
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
                      <Link href={to(item.href)} onClick={close}>
                        <item.icon />
                        <span>{item.label}</span>
                        {item.href === "/findings" &&
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
                {products.slice(0, SIDEBAR_PRODUCTS).map((product) => {
                  const health = metricsFor(product, findings).health
                  const href = to(`/products/${product.id}`)
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
                {products.length > SIDEBAR_PRODUCTS && (
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild className="rounded-full text-muted-foreground">
                      <Link href={to("/products")} onClick={close}>
                        <BoxesIcon />
                        <span>All {products.length} products</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )}
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
                <Link href={to(SETTINGS_ITEM.href)} onClick={close}>
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
