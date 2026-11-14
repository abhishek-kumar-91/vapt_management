"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import { PAGES } from "@/components/app-sidebar"
import { GlobalSearch } from "@/components/global-search"
import { NotificationBell } from "@/components/notifications"
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
import { SidebarTrigger } from "@/components/ui/sidebar"
import { useDashboard } from "@/lib/store"

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
  const page = PAGES.find((nav) =>
    nav.href === "/dashboard"
      ? pathname === "/dashboard"
      : pathname.startsWith(nav.href)
  )
  return [{ label: page?.label ?? "Overview" }]
}

export function SiteHeader() {
  const crumbs = useCrumbs()

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
        <GlobalSearch />
        <NotificationBell />
        <ThemeToggle />
      </div>
    </header>
  )
}
