import type { ReactNode } from "react"
import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/cn"

export enum StatHue {
  Neutral = "Neutral",
  Blue = "Blue",
  Green = "Green",
  Orange = "Orange",
  Red = "Red",
  Purple = "Purple",
  Teal = "Teal",
  Indigo = "Indigo",
}

interface StatCardProps {
  label: string
  value: ReactNode
  hint?: string
  hue?: StatHue
  icon?: LucideIcon
  emphasize?: boolean
}

const iconTileClasses: Readonly<Record<StatHue, string>> = {
  [StatHue.Neutral]: "bg-surface-3/60 text-muted",
  [StatHue.Blue]: "bg-blue-soft text-blue-text",
  [StatHue.Green]: "bg-green-soft text-green-text",
  [StatHue.Orange]: "bg-orange-soft text-orange-text",
  [StatHue.Red]: "bg-red-soft text-red-text",
  [StatHue.Purple]: "bg-purple-soft text-purple-text",
  [StatHue.Teal]: "bg-teal-soft text-teal-text",
  [StatHue.Indigo]: "bg-indigo-soft text-indigo-text",
}

const valueClasses: Readonly<Record<StatHue, string>> = {
  [StatHue.Neutral]: "text-foreground",
  [StatHue.Blue]: "text-blue-text",
  [StatHue.Green]: "text-green-text",
  [StatHue.Orange]: "text-orange-text",
  [StatHue.Red]: "text-red-text",
  [StatHue.Purple]: "text-purple-text",
  [StatHue.Teal]: "text-teal-text",
  [StatHue.Indigo]: "text-indigo-text",
}

export function StatCard({
  label,
  value,
  hint,
  hue = StatHue.Neutral,
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
