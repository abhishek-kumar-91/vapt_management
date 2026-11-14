"use client"

import * as React from "react"
import { usePathname } from "next/navigation"

import { AppSidebar } from "@/components/app-sidebar"
import { BrandLoader } from "@/components/brand-loader"
import { AppearanceProvider, useAppearance } from "@/components/appearance"
import { CurrentUserProvider } from "@/components/current-user"
import type { Appearance } from "@/lib/appearance"
import type { SessionUser } from "@/lib/auth/shared"
import type { DashboardData } from "@/lib/types"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { DashboardProvider, useDashboard } from "@/lib/store"

function Content({ children }: { children: React.ReactNode }) {
  const { hydrated } = useDashboard()
  const pathname = usePathname()
  return (
    <div className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 md:px-8 md:py-8">
      {hydrated ? (
        <div key={pathname} className="animate-settle">
          {children}
        </div>
      ) : (
        // A screen tall, so the footer starts below the fold instead of
        // jumping down when the page arrives (layout shift).
        <div className="min-h-svh">
          <BrandLoader />
        </div>
      )}
    </div>
  )
}

export function ConsoleShell({
  children,
  initialAppearance,
  user,
  data,
}: {
  children: React.ReactNode
  initialAppearance: Appearance
  user: SessionUser
  /** The company's data for this person, loaded on the server. */
  data: DashboardData
}) {
  return (
    <CurrentUserProvider user={user}>
      <DashboardProvider data={data} org={user.org?.slug ?? ""}>
        <AppearanceProvider initial={initialAppearance}>
          <Frame>{children}</Frame>
        </AppearanceProvider>
      </DashboardProvider>
    </CurrentUserProvider>
  )
}

function Frame({ children }: { children: React.ReactNode }) {
  const { appearance } = useAppearance()
  const darkSidebar = appearance === "dark-sidebar"
  return (
    <SidebarProvider
      data-appearance={appearance}
      className={darkSidebar ? "bg-sidebar-contrast!" : undefined}
      style={{ "--sidebar-width": "17.5rem" } as React.CSSProperties}
    >
      <AppSidebar className={darkSidebar ? "dark" : undefined} />
      <SidebarInset className="min-w-0 md:peer-data-[variant=inset]:rounded-3xl md:peer-data-[variant=inset]:shadow-md md:peer-data-[variant=inset]:ring-1 md:peer-data-[variant=inset]:ring-foreground/5">
        <SiteHeader />
        <Content>{children}</Content>
        <footer className="flex flex-wrap justify-between gap-2 px-4 pb-5 text-xs text-muted-foreground md:px-8">
          <span>Pentest Scout security console</span>
          <span>Confidential · internal use only</span>
        </footer>
      </SidebarInset>
    </SidebarProvider>
  )
}
