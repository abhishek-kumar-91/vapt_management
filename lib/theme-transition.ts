import { flushSync } from "react-dom"

/**
 * Switch theme with a circular reveal that grows from `origin` (the toggle button).
 * Falls back to an instant switch without View Transitions or with reduced motion.
 */
export function switchTheme(
  next: "light" | "dark",
  setTheme: (theme: string) => void,
  origin?: Element | null
) {
  const root = document.documentElement
  const apply = () => {
    // Apply the class synchronously so the transition snapshots the new theme; setTheme persists it.
    root.classList.toggle("dark", next === "dark")
    root.style.colorScheme = next
    setTheme(next)
  }

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
  if (!document.startViewTransition || reduce) {
    apply()
    return
  }

  const rect = (
    origin ?? document.querySelector("[data-theme-toggle]")
  )?.getBoundingClientRect()
  const x = rect ? rect.left + rect.width / 2 : window.innerWidth / 2
  const y = rect ? rect.top + rect.height / 2 : 0
  const radius = Math.hypot(
    Math.max(x, window.innerWidth - x),
    Math.max(y, window.innerHeight - y)
  )

  const transition = document.startViewTransition(apply)
  transition.ready
    .then(() => {
      root.animate(
        {
          clipPath: [
            `circle(0px at ${x}px ${y}px)`,
            `circle(${radius}px at ${x}px ${y}px)`,
          ],
        },
        {
          duration: 560,
          easing: "cubic-bezier(0.16, 1, 0.3, 1)",
          pseudoElement: "::view-transition-new(root)",
        }
      )
    })
    .catch(() => {
      /* transition skipped; theme already applied */
    })
}

/** Cross-fade the whole page between two states (used for appearance changes). */
export function fadeTransition(update: () => void) {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
  if (!document.startViewTransition || reduce) {
    update()
    return
  }
  const transition = document.startViewTransition(() => flushSync(update))
  transition.ready
    .then(() => {
      document.documentElement.animate(
        { opacity: [0, 1] },
        {
          duration: 320,
          easing: "cubic-bezier(0.16, 1, 0.3, 1)",
          pseudoElement: "::view-transition-new(root)",
        }
      )
    })
    .catch(() => {
      /* transition skipped; state already applied */
    })
}
