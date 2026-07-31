import { cn } from "@/lib/cn"
import type { BadgeStyle } from "@/lib/crm/config"

interface SoftBadgeProps {
  style: BadgeStyle
  withDot?: boolean
  className?: string
}

export function SoftBadge({ style, withDot = true, className }: SoftBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium",
        style.badge,
        className,
      )}
    >
      {withDot ? (
        <span aria-hidden className={cn("size-[6px] shrink-0 rounded-full", style.dot)} />
      ) : null}
      {style.label}
    </span>
  )
}
