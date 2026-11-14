import { cn } from "@/lib/utils"

/** Sentinel shield-and-check mark. */
export function SentinelMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "grid size-8 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground",
        className
      )}
    >
      <svg
        viewBox="0 0 24 24"
        aria-hidden
        className="size-[18px]"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 2.8 20 6v5.3c0 5-3.4 8.5-8 10.1-4.6-1.6-8-5.1-8-10.1V6z" />
        <path d="m8.6 12 2.2 2.2 4.7-5" />
      </svg>
    </span>
  )
}
