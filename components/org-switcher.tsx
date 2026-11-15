"use client"

import Link from "next/link"
import { CheckIcon, ChevronsUpDownIcon, ShieldCheckIcon } from "lucide-react"

import { BrandMark } from "@/components/brand-mark"
import { useCurrentUser, useOrgPath } from "@/components/current-user"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { SidebarMenuButton, useSidebar } from "@/components/ui/sidebar"

/**
 * Sidebar header: the brand plus the company being viewed. Becomes a switcher when the person
 * can open more than one company, or is a Super Admin (who can also jump back to admin).
 */
export function OrgSwitcher() {
  const user = useCurrentUser()
  const to = useOrgPath()
  const { setOpenMobile, isMobile } = useSidebar()
  const platform = user.role === "SUPER_ADMIN"
  const others = user.orgs.filter((o) => o.slug !== user.org?.slug)
  const switchable = platform || others.length > 0

  const label = (
    <>
      <BrandMark className="size-8!" />
      <span className="grid min-w-0 leading-tight group-data-[collapsible=icon]:hidden">
        <span className="font-semibold tracking-tight">Pentest Scout</span>
        <span className="truncate text-xs text-muted-foreground">
          {user.org?.name ?? "Security console"}
        </span>
      </span>
    </>
  )

  if (!switchable)
    return (
      <SidebarMenuButton size="lg" asChild className="rounded-full">
        <Link href={to()} onClick={() => setOpenMobile(false)}>
          {label}
        </Link>
      </SidebarMenuButton>
    )

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <SidebarMenuButton
          size="lg"
          className="rounded-full data-[state=open]:bg-sidebar-accent"
          aria-label={`Switch company. Current: ${user.org?.name ?? "none"}`}
        >
          {label}
          <ChevronsUpDownIcon className="ml-auto size-4 text-muted-foreground group-data-[collapsible=icon]:hidden" />
        </SidebarMenuButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        side={isMobile ? "bottom" : "right"}
        className="w-64"
      >
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Companies
        </DropdownMenuLabel>
        {user.org && (
          <DropdownMenuItem disabled className="opacity-100!">
            <span className="truncate">{user.org.name}</span>
            <CheckIcon className="ml-auto size-4 text-primary" />
          </DropdownMenuItem>
        )}
        {others.map((o) => (
          <DropdownMenuItem key={o.slug} asChild>
            <Link href={`/o/${o.slug}`} onClick={() => setOpenMobile(false)}>
              <span className="truncate">{o.name}</span>
            </Link>
          </DropdownMenuItem>
        ))}
        {platform && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/admin" onClick={() => setOpenMobile(false)}>
                <ShieldCheckIcon />
                Admin console
              </Link>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
