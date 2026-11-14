import { BrandMark } from "@/components/brand-mark"
import { cn } from "@/lib/utils"

/**
 * Route loading state: the keyring mark at work. The keyhole holds still while the
 * open ring sweeps around it and a scope pulse spreads outward. Fades in late so
 * fast navigations never flash it; a static mark under reduced motion.
 */
export function BrandLoader({
  fullscreen = false,
  className,
}: {
  fullscreen?: boolean
  className?: string
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "grid place-items-center",
        fullscreen ? "min-h-svh bg-background" : "min-h-[60svh]",
        className
      )}
    >
      <div className="grid animate-appear-late justify-items-center gap-5">
        <div className="relative size-16 text-foreground">
          <span
            aria-hidden
            className="absolute inset-[8%] animate-scope-pulse rounded-full border border-foreground/40 motion-reduce:hidden"
          />
          <svg
            viewBox="0 0 64 64"
            aria-hidden
            className="absolute inset-0 animate-scout-orbit motion-reduce:hidden"
          >
            <circle
              cx="32"
              cy="32"
              r="21"
              fill="none"
              stroke="currentColor"
              strokeOpacity={0.1}
              strokeWidth={5.5}
            />
            <circle
              cx="32"
              cy="32"
              r="21"
              fill="none"
              stroke="currentColor"
              strokeWidth={5.5}
              strokeLinecap="round"
              pathLength={1}
              className="animate-scout-sweep"
            />
          </svg>
          <svg
            viewBox="0 0 64 64"
            aria-hidden
            className="absolute inset-0 motion-reduce:hidden"
          >
            <g
              fill="currentColor"
              stroke="currentColor"
              strokeWidth={1.5}
              strokeLinejoin="round"
            >
              <circle cx="32" cy="28.5" r="6" />
              <path d="M30 31h4l1.6 9.5h-7.2z" />
            </g>
          </svg>
          <BrandMark className="absolute inset-0 size-16 motion-safe:hidden" />
        </div>
        {fullscreen && (
          <span className="text-sm font-semibold tracking-tight">
            Pentest Scout
          </span>
        )}
        <span className="sr-only">Loading…</span>
      </div>
    </div>
  )
}
