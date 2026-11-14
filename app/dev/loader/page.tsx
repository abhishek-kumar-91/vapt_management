import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { BrandLoader } from "@/components/brand-loader"

export const metadata: Metadata = { title: "Loader preview" }

/** Dev-only preview of the route loader: full screen on the left, in-canvas on the right. 404s in production. */
export default function LoaderPreview() {
  if (process.env.NODE_ENV !== "development") notFound()
  return (
    <main className="grid min-h-svh bg-sidebar p-2 lg:grid-cols-2 lg:gap-2">
      <div className="overflow-hidden rounded-4xl ring-1 ring-foreground/5">
        <BrandLoader fullscreen />
      </div>
      <div className="grid place-items-center rounded-4xl bg-background shadow-md ring-1 ring-foreground/5">
        <BrandLoader />
      </div>
    </main>
  )
}
