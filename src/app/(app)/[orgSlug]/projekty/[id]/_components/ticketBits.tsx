import { CalendarClock, ListChecks } from "lucide-react"
import { formatCzechDate, todayIso } from "@/lib/dates"
import { cn } from "@/lib/cn"
import type { BadgeStyle } from "@/lib/crm/config"

export function PriorityTag({ style, loud }: { style: BadgeStyle; loud: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium",
        style.badge,
        loud && "font-semibold",
      )}
    >
      <span aria-hidden className={cn("size-[7px] shrink-0 rounded-full", style.dot)} />
      {style.label}
    </span>
  )
}

export function DueTag({ dueAt, done }: { dueAt?: string; done: boolean }) {
  if (dueAt === undefined) {
    return null
  }
  const overdue = !done && dueAt < todayIso()
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap text-[11px] tabular-nums",
        overdue ? "font-medium text-red-text" : "text-muted",
      )}
    >
      <CalendarClock className="size-3" />
      {overdue ? `po termínu, ${formatCzechDate(dueAt)}` : formatCzechDate(dueAt)}
    </span>
  )
}

export function SubtaskBadge({ done, total }: { done: number; total: number }) {
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap text-[11px] tabular-nums text-muted">
      <ListChecks className="size-3" />
      {done}/{total}
    </span>
  )
}
