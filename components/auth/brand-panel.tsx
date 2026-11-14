import { CloseoutMeter } from "@/components/closeout-meter"
import { ProductAvatar } from "@/components/product-avatar"
import { SentinelMark } from "@/components/sentinel-mark"
import sampleData from "@/data.json"
import { areaCounts } from "@/lib/metrics"
import { PRODUCT_ORDER } from "@/lib/sop"
import type { DashboardData } from "@/lib/types"

const data = sampleData as unknown as DashboardData

const SOP_FACTS = [
  { value: "80%", label: "Baseline close-out line" },
  { value: "7 days", label: "Critical fix deadline" },
  { value: "2 days", label: "Retest turnaround" },
]

/** Left half of the sign-in screen: the brand, and the close-out meter doing its job on sample data. */
export function BrandPanel() {
  const rows = PRODUCT_ORDER.filter((id) => data.products[id])
    .slice(0, 4)
    .map((id) => {
      const product = data.products[id]
      const counts = areaCounts(product.areas)
      const total = product.areas.length
      return {
        id,
        name: product.name,
        counts,
        coverage: total ? Math.round((counts.Tested / total) * 100) : 0,
      }
    })

  return (
    <section
      aria-label="About Sentinel"
      className="relative hidden overflow-hidden rounded-4xl bg-primary p-10 text-white lg:flex lg:flex-col xl:p-12 dark:bg-[oklch(0.32_0.13_274)]"
    >
      <div className="flex items-center gap-3">
        <SentinelMark className="size-10 bg-white text-primary dark:text-[oklch(0.32_0.13_274)]" />
        <div className="grid leading-tight">
          <span className="text-lg font-semibold tracking-tight">Sentinel</span>
          <span className="text-sm text-white/70">Security console</span>
        </div>
      </div>

      <div className="mt-auto grid max-w-lg gap-4 pt-16">
        <h2 className="text-4xl leading-[1.1] font-semibold tracking-tight text-balance xl:text-[2.75rem]">
          Every test area, measured against the close-out line.
        </h2>
        <p className="max-w-md text-base text-pretty text-white/75">
          Coverage, findings, retests and SOP test cycles for every product, in
          one console your whole security team reads the same way.
        </p>
      </div>

      <div className="mt-10 animate-settle rounded-3xl bg-card p-5 text-card-foreground shadow-2xl shadow-black/20 [animation-delay:120ms]">
        <div className="mb-4 flex items-baseline justify-between">
          <span className="text-sm font-medium">Portfolio coverage</span>
          <span className="text-xs text-muted-foreground">Sample data</span>
        </div>
        <ul className="grid gap-3.5">
          {rows.map((row) => (
            <li
              key={row.id}
              className="grid grid-cols-[auto_minmax(0,1fr)_3rem] items-center gap-3"
            >
              <ProductAvatar id={row.id} name={row.name} />
              <div className="grid min-w-0 gap-1.5">
                <span className="truncate text-sm">{row.name}</span>
                <CloseoutMeter counts={row.counts} size="sm" />
              </div>
              <span className="text-right text-sm font-medium tabular">
                {row.coverage}%
              </span>
            </li>
          ))}
        </ul>
      </div>

      <dl className="mt-8 grid grid-cols-3 gap-6 border-t border-white/15 pt-6">
        {SOP_FACTS.map((fact) => (
          <div key={fact.label} className="grid gap-1">
            <dt className="order-2 text-sm text-white/70">{fact.label}</dt>
            <dd className="order-1 text-xl font-semibold tracking-tight tabular">
              {fact.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
