import { forwardRef } from "react"
import { cn } from "@/lib/cn"

type InputVariant = "default" | "search"

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  variant?: InputVariant
}

const baseClasses =
  "flex h-11 w-full rounded-xl border border-border-strong/60 bg-surface px-4 text-[15px] text-foreground transition-[border-color,box-shadow] duration-150 placeholder:text-muted-soft hover:border-border-strong focus-visible:border-primary focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-danger aria-[invalid=true]:focus-visible:ring-danger/20"

const variantClasses: Readonly<Record<InputVariant, string>> = {
  default: "",
  search:
    "h-10 rounded-full border-transparent bg-surface-2 pl-10 pr-14 text-sm hover:border-transparent focus-visible:bg-surface",
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = "text", variant = "default", ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(baseClasses, variantClasses[variant], className)}
      {...props}
    />
  ),
)
Input.displayName = "Input"
