import type { ReactNode } from "react"
import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/cn"

export type StatHue =
  | "neutral"
  | "blue"
  | "green"
  | "orange"
  | "red"
  | "purple"
  | "teal"
  | "indigo"

interface StatCardProps {
  label: string
  value: ReactNode
  hint?: string
  hue?: StatHue
  icon?: LucideIcon
  emphasize?: boolean
}

const iconTileClasses: Readonly<Record<StatHue, string>> = {
  neutral: "bg-surface-3/60 text-muted",
  blue: "bg-blue-soft text-blue-text",
  green: "bg-green-soft text-green-text",
  orange: "bg-orange-soft text-orange-text",
  red: "bg-red-soft text-red-text",
  purple: "bg-purple-soft text-purple-text",
  teal: "bg-teal-soft text-teal-text",
  indigo: "bg-indigo-soft text-indigo-text",
}

const valueClasses: Readonly<Record<StatHue, string>> = {
  neutral: "text-foreground",
  blue: "text-blue-text",
  green: "text-green-text",
  orange: "text-orange-text",
  red: "text-red-text",
  purple: "text-purple-text",
  teal: "text-teal-text",
  indigo: "text-indigo-text",
}

export function StatCard({
  label,
  value,
  hint,
  hue = "neutral",
  icon: Icon,
  emphasize = false,
}: StatCardProps) {
  return (
    <div className="h-full rounded-2xl border border-hairline bg-surface px-5 py-4 shadow-soft">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-medium text-muted">{label}</span>
        {Icon ? (
          <span
            className={cn(
              "flex size-6 shrink-0 items-center justify-center rounded-[7px]",
              iconTileClasses[hue],
            )}
          >
            <Icon className="size-3.5" strokeWidth={2.25} />
          </span>
        ) : null}
      </div>
      <div
        className={cn(
          "mt-1 text-[32px] font-semibold leading-none tabular-nums tracking-tight",
          emphasize ? valueClasses[hue] : "text-foreground",
        )}
      >
        {value}
      </div>
      {hint ? <p className="mt-1.5 text-xs text-muted-soft">{hint}</p> : null}
    </div>
  )
}
