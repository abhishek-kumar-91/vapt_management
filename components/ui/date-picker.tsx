"use client"

import * as React from "react"
import { CalendarIcon } from "lucide-react"
import { cn } from "cn"

import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { formatDate, LONG_DATE, toIso } from "@/lib/dates"

/** Drop-in for `<Input type="date">`: value and onChange use `yyyy-mm-dd` strings. */
function DatePicker({
  value,
  onChange,
  placeholder = "Pick a date",
  required,
  className,
  ...props
}: Omit<React.ComponentProps<"button">, "value" | "onChange"> & {
  value?: string
  onChange: (value: string) => void
  placeholder?: string
  required?: boolean
}) {
  const [open, setOpen] = React.useState(false)
  const selected = value ? new Date(`${value}T00:00:00`) : undefined

  const picker = (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-slot="date-picker"
          data-empty={!value}
          className={cn(
            "flex h-9 w-full min-w-0 items-center justify-between gap-2 rounded-3xl border border-transparent bg-input/50 px-3 text-left text-base tabular-nums transition-[color,box-shadow,background-color] outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 data-[empty=true]:text-muted-foreground data-[state=open]:border-ring data-[state=open]:ring-3 data-[state=open]:ring-ring/30 md:text-sm",
            className
          )}
          {...props}
        >
          <span className="truncate">
            {value ? formatDate(value, LONG_DATE) : placeholder}
          </span>
          <CalendarIcon className="size-4 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto overflow-hidden p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          defaultMonth={selected}
          captionLayout="dropdown"
          onSelect={(date) => {
            onChange(date ? toIso(date) : "")
            setOpen(false)
          }}
        />
      </PopoverContent>
    </Popover>
  )

  if (!required) return picker
  // Buttons can't be `required`; a hidden input keeps native form validation.
  return (
    <div className="relative">
      {picker}
      <input
        tabIndex={-1}
        aria-hidden
        required
        value={value ?? ""}
        onChange={() => {}}
        onFocus={() => setOpen(true)}
        className="pointer-events-none absolute bottom-0 left-4 size-px opacity-0"
      />
    </div>
  )
}

export { DatePicker }
