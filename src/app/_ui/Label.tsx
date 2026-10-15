import { forwardRef } from "react"
import { cn } from "@/lib/cn"

export const Label = forwardRef<HTMLLabelElement, React.LabelHTMLAttributes<HTMLLabelElement>>(
  function Label({ className, ...props }, ref) {
    return (
      <label
        ref={ref}
        className={cn("text-[13px] font-medium leading-none text-muted", className)}
        {...props}
      />
    )
  },
)
