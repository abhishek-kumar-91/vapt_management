"use client"

import * as React from "react"

import { BrandMark } from "@/components/brand-mark"

// The mark's opening sits at -45° (up-right) in its own drawing.
const GAP_ANGLE = -45
const TICKS = Array.from({ length: 72 }, (_, i) => i * 5)

/**
 * Left half of the sign-in screen: the keyring mark as an instrument.
 * The open ring scans slowly on its own and turns its opening toward the pointer;
 * a soft lens reveals the dot field under the cursor. Static under reduced motion.
 */
export function BrandPanel() {
  const panel = React.useRef<HTMLElement>(null)
  const dial = React.useRef<SVGSVGElement>(null)
  const ring = React.useRef<SVGGElement>(null)
  const ticks = React.useRef<SVGGElement>(null)
  const keyhole = React.useRef<SVGGElement>(null)

  React.useEffect(() => {
    const el = panel.current
    if (!el || matchMedia("(prefers-reduced-motion: reduce)").matches) return

    // Pointer relative to the panel, and to the dial centre (as a fraction of the dial).
    let pointer: { x: number; y: number; dx: number; dy: number } | null = null
    let target = 0
    let angle = 0
    const lens = { x: 0, y: 0, o: 0 }
    const hole = { x: 0, y: 0 }
    let frame = 0

    const move = (event: PointerEvent) => {
      const p = el.getBoundingClientRect()
      const d = dial.current!.getBoundingClientRect()
      const x = event.clientX - p.left
      const y = event.clientY - p.top
      if (!pointer) Object.assign(lens, { x, y })
      pointer = {
        x,
        y,
        dx: (event.clientX - (d.left + d.width / 2)) / d.width,
        dy: (event.clientY - (d.top + d.height / 2)) / d.height,
      }
    }
    const leave = () => (pointer = null)

    const tick = () => {
      if (pointer) {
        const toward =
          (Math.atan2(pointer.dy, pointer.dx) * 180) / Math.PI - GAP_ANGLE
        // Shortest way round, so the ring never spins the long way.
        target += ((((toward - target) % 360) + 540) % 360) - 180
      } else {
        target += 0.04 // idle scan: one turn every ~2.5 minutes
      }
      angle += (target - angle) * 0.05

      const reach = pointer
        ? Math.min(1, Math.hypot(pointer.dx, pointer.dy) * 3)
        : 0
      const toX = pointer
        ? Math.cos(Math.atan2(pointer.dy, pointer.dx)) * reach * 1.6
        : 0
      const toY = pointer
        ? Math.sin(Math.atan2(pointer.dy, pointer.dx)) * reach * 1.6
        : 0
      hole.x += (toX - hole.x) * 0.08
      hole.y += (toY - hole.y) * 0.08

      if (pointer) {
        lens.x += (pointer.x - lens.x) * 0.14
        lens.y += (pointer.y - lens.y) * 0.14
      }
      lens.o += ((pointer ? 1 : 0) - lens.o) * 0.06

      ring.current?.setAttribute("transform", `rotate(${angle} 32 32)`)
      ticks.current?.setAttribute("transform", `rotate(${angle * -0.3} 32 32)`)
      keyhole.current?.setAttribute(
        "transform",
        `translate(${hole.x} ${hole.y})`
      )
      el.style.setProperty("--lx", `${lens.x}px`)
      el.style.setProperty("--ly", `${lens.y}px`)
      el.style.setProperty("--lo", lens.o.toFixed(3))
      frame = requestAnimationFrame(tick)
    }

    el.addEventListener("pointermove", move)
    el.addEventListener("pointerleave", leave)
    frame = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(frame)
      el.removeEventListener("pointermove", move)
      el.removeEventListener("pointerleave", leave)
    }
  }, [])

  return (
    <section
      ref={panel}
      aria-label="About Pentest Scout"
      className="relative isolate hidden overflow-hidden rounded-4xl bg-primary p-10 text-white lg:flex lg:flex-col xl:p-12 dark:bg-[oklch(0.22_0_0)] dark:ring-1 dark:ring-white/10"
    >
      {/* Dot field: faint everywhere, brighter under the pointer's lens. */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[radial-gradient(circle,rgb(255_255_255/0.09)_1px,transparent_1.5px)] bg-size-[22px_22px]"
      />
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[radial-gradient(circle,rgb(255_255_255/0.5)_1px,transparent_1.6px)] mask-[radial-gradient(260px_circle_at_var(--lx,50%)_var(--ly,50%),black,transparent)] bg-size-[22px_22px] opacity-(--lo,0)"
      />

      <svg
        ref={dial}
        aria-hidden
        viewBox="-32 -32 128 128"
        className="pointer-events-none absolute top-[42%] left-1/2 -z-10 aspect-square w-[118%] max-w-none -translate-x-1/2 -translate-y-1/2"
      >
        <g fill="none" stroke="white">
          <circle
            cx="32"
            cy="32"
            r="29"
            strokeOpacity={0.08}
            strokeWidth={0.12}
          />
          <circle
            cx="32"
            cy="32"
            r="44"
            strokeOpacity={0.06}
            strokeWidth={0.12}
          />
          <circle
            cx="32"
            cy="32"
            r="58"
            strokeOpacity={0.05}
            strokeWidth={0.12}
          />
          <g ref={ticks} strokeOpacity={0.28}>
            {TICKS.map((deg) => (
              <line
                key={deg}
                x1="32"
                y1={32 - 34}
                x2="32"
                y2={32 - (deg % 30 === 0 ? 36.2 : 35)}
                strokeWidth={deg % 30 === 0 ? 0.3 : 0.16}
                transform={`rotate(${deg} 32 32)`}
              />
            ))}
          </g>
        </g>
        <g ref={ring}>
          <path
            d="M50.5 22A21 21 0 1 1 42 13.6"
            fill="none"
            stroke="white"
            strokeWidth={5.5}
            strokeLinecap="round"
            pathLength={1}
            className="animate-draw-ring"
          />
        </g>
        <g ref={keyhole}>
          <g
            fill="white"
            stroke="white"
            strokeWidth={1.5}
            strokeLinejoin="round"
            className="animate-settle [animation-delay:500ms]"
          >
            <circle cx="32" cy="28.5" r="6" />
            <path d="M30 31h4l1.6 9.5h-7.2z" />
          </g>
        </g>
      </svg>

      <div className="flex items-center gap-3">
        <BrandMark className="size-10 text-white" />
        <div className="grid leading-tight">
          <span className="text-lg font-semibold tracking-tight">
            Pentest Scout
          </span>
          <span className="text-sm text-white/70">Security console</span>
        </div>
      </div>

      <div className="mt-auto grid max-w-lg gap-4 pt-16">
        <h2 className="text-4xl leading-[1.08] font-semibold tracking-tight text-balance xl:text-5xl">
          Scout every surface. Close every finding.
        </h2>
        <p className="max-w-md text-base text-pretty text-white/70">
          Plan assessments, track findings through retest and see coverage
          across every product your team secures.
        </p>
      </div>
    </section>
  )
}
