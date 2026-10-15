"use client"

import * as PopoverPrimitive from "@radix-ui/react-popover"
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns"
import { cs } from "date-fns/locale"
import { motion, useReducedMotion } from "framer-motion"
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react"
import { useState } from "react"
import { cn } from "@/lib/cn"
import { formatCzechDate } from "@/lib/dates"

interface DatePickerProps {
  value: string | null
  onChange: (iso: string) => void
  id?: string
  placeholder?: string
}

const WEEKDAY_LABELS = ["po", "út", "st", "čt", "pá", "so", "ne"] as const

export const DatePicker = ({
  value,
  onChange,
  id,
  placeholder = "Vyberte datum",
}: DatePickerProps) => {
  const reduceMotion = useReducedMotion()
  const selected = value !== null && value.length > 0 ? parseISO(value) : null
  const [open, setOpen] = useState(false)
  const [viewMonth, setViewMonth] = useState(() => selected ?? new Date())

  const gridStart = startOfWeek(startOfMonth(viewMonth), { weekStartsOn: 1 })
  const gridEnd = endOfWeek(endOfMonth(viewMonth), { weekStartsOn: 1 })
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd })

  const handleSelect = (day: Date) => {
    onChange(format(day, "yyyy-MM-dd"))
    setOpen(false)
  }

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger
        id={id}
        className={cn(
          "flex h-11 w-full items-center gap-2.5 rounded-xl border border-border-strong/60 bg-surface px-4 text-[15px] transition-[border-color,box-shadow] duration-150 hover:border-border-strong focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/20 data-[state=open]:border-primary data-[state=open]:ring-[3px] data-[state=open]:ring-primary/20",
          selected === null ? "text-muted-soft" : "text-foreground",
        )}
      >
        <Calendar className="h-4 w-4 shrink-0 text-muted-soft" />
        {selected !== null ? formatCzechDate(value) : placeholder}
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={6}
          className="z-50 w-[17.5rem] rounded-xl border border-hairline bg-surface p-3 shadow-lifted outline-none"
          asChild
        >
          <motion.div
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }}
            style={{ transformOrigin: "var(--radix-popover-content-transform-origin)" }}
          >
            <div className="mb-2 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setViewMonth((month) => subMonths(month, 1))}
                className="flex h-8 w-8 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
                aria-label="Předchozí měsíc"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-sm font-medium capitalize text-foreground">
                {format(viewMonth, "LLLL yyyy", { locale: cs })}
              </span>
              <button
                type="button"
                onClick={() => setViewMonth((month) => addMonths(month, 1))}
                className="flex h-8 w-8 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
                aria-label="Další měsíc"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-7 gap-1">
              {WEEKDAY_LABELS.map((label) => (
                <div
                  key={label}
                  className="flex h-8 items-center justify-center text-xs font-medium text-muted-soft"
                >
                  {label}
                </div>
              ))}
              {days.map((day) => {
                const isCurrentMonth = isSameMonth(day, viewMonth)
                const isSelected = selected !== null && isSameDay(day, selected)
                const isCurrentDay = isToday(day)

                return (
                  <button
                    key={day.toISOString()}
                    type="button"
                    onClick={() => handleSelect(day)}
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-full text-sm transition-colors hover:bg-surface-2",
                      !isCurrentMonth && "text-muted-soft",
                      isCurrentMonth && !isSelected && "text-foreground",
                      isCurrentDay && !isSelected && "font-semibold text-primary",
                      isSelected &&
                        "bg-primary font-medium text-primary-foreground hover:bg-primary-hover",
                    )}
                  >
                    {format(day, "d")}
                  </button>
                )
              })}
            </div>
          </motion.div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  )
}
