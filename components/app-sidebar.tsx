"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  ActivityIcon,
  FileTextIcon,
  InfoIcon,
  LayoutDashboardIcon,
  type LucideIcon,
  SettingsIcon,
  ShieldAlertIcon,
} from "lucide-react"

import { SentinelMark } from "@/components/sentinel-mark"
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
  { href: "/dashboard/settings", label: "Settings", icon: SettingsIcon },
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
  const openCount = findings.filter((finding) => !isClosed(finding)).length
  const isActive = (href: string) =>
    href === "/dashboard"
      ? pathname === "/dashboard"
      : pathname.startsWith(href)
  const close = () => setOpenMobile(false)

  return (
    <Sidebar variant="inset" collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild className="rounded-full">
              <Link href="/dashboard" onClick={close}>
                <SentinelMark className="size-8" />
                <span className="grid leading-tight group-data-[collapsible=icon]:hidden">
                  <span className="font-semibold tracking-tight">Sentinel</span>
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
              {NAV_ITEMS.map((item) => (
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

      <SidebarFooter>
        <div className="flex gap-2.5 rounded-3xl bg-warning/12 p-3 text-xs leading-relaxed text-[color-mix(in_oklch,var(--warning),black_50%)] group-data-[collapsible=icon]:hidden dark:text-warning">
          <InfoIcon className="mt-0.5 size-4 shrink-0" />
          <p>
            <span className="font-semibold">Sample data only.</span> Don’t use
            this as a live security report.
          </p>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
