"use client"

import * as React from "react"
import { LoaderCircleIcon } from "lucide-react"
import { toast } from "sonner"

import {
  getProductAccessAction,
  setProductAccessAction,
} from "@/app/o/[org]/users/actions"
import { useCurrentUser } from "@/components/current-user"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import type { TeamUser } from "@/lib/users"

type Level = "none" | "view" | "edit"

const LEVELS: { value: Level; label: string }[] = [
  { value: "none", label: "No access" },
  { value: "view", label: "View" },
  { value: "edit", label: "Edit" },
]

/** Choose, per product, whether a member can't see it, can view it, or can work on it. */
export function ProductAccessSheet({
  user,
  onClose,
}: {
  user: TeamUser | null
  onClose: () => void
}) {
  const org = useCurrentUser().org!.slug
  const [rows, setRows] = React.useState<
    { productId: string; name: string; editable: boolean; level: Level; initial: Level }[] | null
  >(null)
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    if (!user) return
    let live = true
    getProductAccessAction(org, user.id)
      .then((list) => {
        if (!live) return
        if (!list) {
          toast.error("You can’t change this member’s product access.")
          return onClose()
        }
        const next = list.map((r) => ({
          productId: r.productId,
          name: r.name,
          editable: r.editable,
          level: (r.access ?? "none") as Level,
          initial: (r.access ?? "none") as Level,
        }))
        setRows(next)
      })
      .catch(() => {
        toast.error("Couldn’t load product access. Try again.")
        onClose()
      })
    return () => {
      live = false
      setRows(null)
    }
  }, [user, org, onClose])

  const changed = rows?.filter((r) => r.initial !== r.level) ?? []

  const save = async () => {
    if (!user || !changed.length) return onClose()
    setSaving(true)
    const result = await setProductAccessAction(
      org,
      user.id,
      Object.fromEntries(changed.map((r) => [r.productId, r.level]))
    ).catch(() => ({ ok: false as const, error: "Check your connection and try again." }))
    setSaving(false)
    if (!result.ok) return void toast.error("Access not saved", { description: result.error })
    toast.success(`Product access saved for ${user.name}`, {
      description: "It applies on their next page load.",
    })
    onClose()
  }

  return (
    <Sheet open={!!user} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="flex flex-col gap-0 sm:max-w-md">
        <SheetHeader className="border-b px-6 py-5">
          <SheetTitle>Product access</SheetTitle>
          <SheetDescription>
            {user?.name} sees only the products set to View or Edit. Edit lets them
            work on a product as their role allows.
          </SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {!rows ? (
            <div className="grid gap-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-10 rounded-2xl" />
              ))}
            </div>
          ) : rows.length ? (
            <ul className="grid divide-y">
              {rows.map((r) => (
                <li key={r.productId} className="flex items-center gap-3 py-3">
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {r.name}
                  </span>
                  <div
                    role="radiogroup"
                    aria-label={`Access to ${r.name}`}
                    className="flex rounded-full bg-muted p-0.5"
                  >
                    {LEVELS.map((l) => (
                      <button
                        key={l.value}
                        type="button"
                        role="radio"
                        aria-checked={r.level === l.value}
                        disabled={!r.editable}
                        onClick={() =>
                          setRows((all) =>
                            all!.map((x) =>
                              x.productId === r.productId ? { ...x, level: l.value } : x
                            )
                          )
                        }
                        className="rounded-full px-2.5 py-1 text-xs font-medium text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50 aria-checked:bg-background aria-checked:text-foreground aria-checked:shadow-sm"
                      >
                        {l.label}
                      </button>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No products yet. An Owner adds them on the Products page.
            </p>
          )}
        </div>
        <SheetFooter className="flex-row justify-end gap-2 border-t px-6 py-4">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving || !rows}>
            {saving && <LoaderCircleIcon className="animate-spin" />}
            {saving ? "Saving…" : changed.length ? `Save ${changed.length} change${changed.length === 1 ? "" : "s"}` : "Done"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
