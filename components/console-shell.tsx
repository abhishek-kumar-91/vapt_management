"use client"

import * as React from "react"
import { usePathname } from "next/navigation"

import { AppSidebar } from "@/components/app-sidebar"
import { AppearanceProvider, useAppearance } from "@/components/appearance"
import type { Appearance } from "@/lib/appearance"
import { SiteHeader } from "@/components/site-header"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Skeleton } from "@/components/ui/skeleton"
import { DashboardProvider, useDashboard } from "@/lib/store"

function PageSkeleton() {
  return (
    <div className="grid gap-6" aria-busy="true" aria-label="Loading dashboard">
      <div className="grid gap-2">
        <Skeleton className="h-8 w-56 rounded-full" />
        <Skeleton className="h-4 w-80 rounded-full" />
      </div>
      <Skeleton className="h-40 rounded-4xl" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-72 rounded-4xl" />
        <Skeleton className="h-72 rounded-4xl" />
      </div>
    </div>
  )
}

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
        <PageSkeleton />
      )}
    </div>
  )
}

export function ConsoleShell({
  children,
  initialAppearance,
}: {
  children: React.ReactNode
  initialAppearance: Appearance
}) {
  return (
    <DashboardProvider>
      <AppearanceProvider initial={initialAppearance}>
        <Frame>{children}</Frame>
      </AppearanceProvider>
    </DashboardProvider>
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
          <span>Sentinel security console</span>
          <span>Confidential · internal use only · sample data</span>
        </footer>
      </SidebarInset>
    </SidebarProvider>
  )
}
