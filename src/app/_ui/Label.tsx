import { forwardRef } from "react"
import { cn } from "@/lib/cn"

export const Label = forwardRef<HTMLLabelElement, React.LabelHTMLAttributes<HTMLLabelElement>>(
  ({ className, ...props }, ref) => (
    <label
      ref={ref}
      className={cn("text-[13px] font-medium leading-none text-muted", className)}
      {...props}
    />
  ),
)
Label.displayName = "Label"
