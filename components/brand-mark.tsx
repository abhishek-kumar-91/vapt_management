import { cn } from "@/lib/utils"

/** Pentest Scout keyring mark: an open scouting ring around a keyhole. Draws in currentColor. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      aria-hidden
      className={cn("size-8 shrink-0 text-foreground", className)}
    >
      <path
        d="M50.5 22A21 21 0 1 1 42 13.6"
        fill="none"
        stroke="currentColor"
        strokeWidth={5.5}
        strokeLinecap="round"
      />
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
  )
}
