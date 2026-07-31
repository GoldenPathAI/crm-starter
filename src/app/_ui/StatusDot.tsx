import type { ReactNode } from "react"
import { cn } from "@/lib/cn"

interface StatusDotProps {
  dotClassName: string
  children: ReactNode
  className?: string
}

export function StatusDot({ dotClassName, children, className }: StatusDotProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap text-[13px] text-foreground",
        className,
      )}
    >
      <span aria-hidden className={cn("size-[7px] shrink-0 rounded-full", dotClassName)} />
      {children}
    </span>
  )
}
