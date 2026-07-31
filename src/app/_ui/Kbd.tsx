import type { ComponentProps } from "react"
import { cn } from "@/lib/cn"

export function Kbd({ className, ...props }: ComponentProps<"kbd">) {
  return (
    <kbd
      className={cn(
        "rounded-md border border-border-strong/60 bg-surface-2 px-1.5 py-0.5 text-[11px] font-medium text-muted-soft",
        className,
      )}
      {...props}
    />
  )
}
