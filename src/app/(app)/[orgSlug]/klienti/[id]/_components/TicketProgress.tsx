import { cn } from "@/lib/cn"

interface TicketProgressProps {
  done: number
  total: number
  className?: string
}

export function TicketProgress({ done, total, className }: TicketProgressProps) {
  const ratio = total > 0 ? done / total : 0
  const complete = total > 0 && done === total

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex items-center justify-between text-[11px] font-medium text-muted-soft">
        <span>{total > 0 ? `${done}/${total} hotovo` : "Bez úkolů"}</span>
        <span className="tabular-nums">{Math.round(ratio * 100)} %</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-surface-3/70">
        <div
          className={cn("h-full rounded-full transition-all", complete ? "bg-green" : "bg-primary")}
          style={{ width: `${Math.round(ratio * 100)}%` }}
        />
      </div>
    </div>
  )
}
