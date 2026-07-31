import type { ComponentProps } from "react"
import { cn } from "@/lib/cn"

interface PageShellProps extends ComponentProps<"div"> {
  // Wide surfaces (tables, boards, dashboards) opt into the ultrawide max-width
  // ladder in the app layout via the data-wide marker. Forms and detail pages
  // stay at the readable narrow column.
  wide?: boolean
}

export function PageShell({ wide, className, ...props }: PageShellProps) {
  return (
    <div data-wide={wide ? "" : undefined} className={cn("flex flex-col gap-6", className)} {...props} />
  )
}
