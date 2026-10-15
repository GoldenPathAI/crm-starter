import { forwardRef } from "react"
import { cn } from "@/lib/cn"

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(
        "flex min-h-20 w-full resize-none rounded-xl border border-border-strong/60 bg-surface px-4 py-3 text-[15px] text-foreground transition-[border-color,box-shadow] duration-150 placeholder:text-muted-soft hover:border-border-strong focus-visible:border-primary focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-danger aria-[invalid=true]:focus-visible:ring-danger/20",
        className,
      )}
      {...props}
    />
  )
})
