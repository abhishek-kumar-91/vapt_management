"use client"

import { MailIcon, PaletteIcon, ShieldCheckIcon } from "lucide-react"

import { SettingsLayout, type SettingsNavItem } from "@/components/settings/settings-layout"

const SECTIONS: SettingsNavItem[] = [
  { id: "appearance", label: "Appearance", icon: PaletteIcon },
  { id: "admins", label: "Super Admins", icon: ShieldCheckIcon },
  { id: "email", label: "Email", icon: MailIcon },
]

/** The owner Settings layout with the admin console's sections. */
export function AdminSettingsLayout({ children }: { children: React.ReactNode }) {
  return <SettingsLayout items={SECTIONS}>{children}</SettingsLayout>
}
