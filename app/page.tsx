"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

/**
 * Placeholder until the home page exists: send visitors to sign in.
 * Old Vite links (`/#p-<product-id>`) go straight to that product.
 */
export default function Home() {
  const router = useRouter()
  React.useEffect(() => {
    const match = /^#p-(.+)$/.exec(window.location.hash)
    router.replace(match ? `/dashboard/products/${match[1]}` : "/login")
  }, [router])
  return null
}
