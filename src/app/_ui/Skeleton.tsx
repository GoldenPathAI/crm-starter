import type { ComponentProps } from "react"
import { cn } from "@/lib/cn"

export function Skeleton({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      aria-hidden
      className={cn("relative overflow-hidden rounded-lg bg-surface-2", className)}
      {...props}
    >
      <span className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-surface-3/60 to-transparent motion-reduce:animate-none" />
    </div>
  )
}
