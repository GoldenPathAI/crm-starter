import type { ComponentProps } from "react"
import { cn } from "@/lib/cn"

export function Table({ className, ...props }: ComponentProps<"table">) {
  return <table className={cn("w-full border-collapse text-sm", className)} {...props} />
}

export function THead({ className, ...props }: ComponentProps<"thead">) {
  return <thead className={cn("text-left", className)} {...props} />
}

export function TBody({ className, ...props }: ComponentProps<"tbody">) {
  return <tbody {...props} className={className} />
}

// Solid hover (no alpha): the sticky first column paints an opaque background so
// horizontally scrolled content cannot bleed under it, and a translucent row hover
// would render a visibly different shade next to it.
export function TR({ className, ...props }: ComponentProps<"tr">) {
  return <tr className={cn("transition-colors hover:bg-surface-2", className)} {...props} />
}

export function TH({ className, scope = "col", ...props }: ComponentProps<"th">) {
  return (
    <th
      scope={scope}
      className={cn("px-4 py-3 text-left text-xs font-medium text-muted-soft", className)}
      {...props}
    />
  )
}

export function TD({ className, ...props }: ComponentProps<"td">) {
  return (
    <td
      className={cn("border-t border-hairline px-4 py-3.5 align-middle", className)}
      {...props}
    />
  )
}
