"use client"

import * as PopoverPrimitive from "@radix-ui/react-popover"
import { motion, useReducedMotion } from "framer-motion"
import { forwardRef } from "react"
import { cn } from "@/lib/cn"

export const Popover = PopoverPrimitive.Root
export const PopoverTrigger = PopoverPrimitive.Trigger

export const PopoverContent = forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, align = "start", sideOffset = 6, children, ...props }, ref) => {
  const reduceMotion = useReducedMotion()

  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        ref={ref}
        align={align}
        sideOffset={sideOffset}
        className={cn(
          "z-50 rounded-xl border border-hairline bg-surface p-1.5 text-foreground shadow-lifted outline-none",
          className,
        )}
        asChild
        {...props}
      >
        <motion.div
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 4, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }}
          style={{ transformOrigin: "var(--radix-popover-content-transform-origin)" }}
        >
          {children}
        </motion.div>
      </PopoverPrimitive.Content>
    </PopoverPrimitive.Portal>
  )
})
PopoverContent.displayName = "PopoverContent"
