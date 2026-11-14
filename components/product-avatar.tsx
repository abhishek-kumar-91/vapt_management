import { cn } from "@/lib/utils"
import { PRODUCT_ORDER } from "@/lib/sop"

const TINTS = [
  "bg-chart-1/12 text-chart-1",
  "bg-chart-4/20 text-[color-mix(in_oklch,var(--chart-4),black_40%)] dark:text-chart-4",
  "bg-chart-3/15 text-[color-mix(in_oklch,var(--chart-3),black_25%)] dark:text-chart-3",
  "bg-chart-5/12 text-chart-5",
  "bg-chart-2/15 text-[color-mix(in_oklch,var(--chart-2),black_30%)] dark:text-chart-2",
]

function tintFor(id: string) {
  const index = PRODUCT_ORDER.indexOf(id)
  const hash =
    index >= 0
      ? index
      : [...id].reduce((sum, char) => sum + char.charCodeAt(0), 0)
  return TINTS[hash % TINTS.length]
}

/** Monogram from the last path segment, e.g. "remplatforms/wallet" → "WA". */
function monogram(name: string) {
  const base = name.split("/").pop() || name
  return base.slice(0, 2).toUpperCase()
}

export function ProductAvatar({
  id,
  name,
  size = "default",
  className,
}: {
  id: string
  name: string
  size?: "default" | "lg"
  className?: string
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid shrink-0 place-items-center rounded-full font-semibold tracking-tight",
        size === "default" ? "size-8 text-xs" : "size-12 text-sm",
        tintFor(id),
        className
      )}
    >
      {monogram(name)}
    </span>
  )
}
