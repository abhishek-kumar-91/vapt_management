import { BrandLoader } from "@/components/brand-loader"

/** Full-screen loader for top-level transitions, e.g. signing in to the console. */
export default function Loading() {
  return <BrandLoader fullscreen />
}
