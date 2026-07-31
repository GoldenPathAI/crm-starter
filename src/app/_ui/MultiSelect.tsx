"use client"

import * as PopoverPrimitive from "@radix-ui/react-popover"
import { motion, useReducedMotion } from "framer-motion"
import { ChevronDown } from "lucide-react"
import { Checkbox } from "@/app/_ui/Checkbox"
import { cn } from "@/lib/cn"

interface MultiSelectOption {
  value: string
  label: string
}

interface MultiSelectProps {
  values: string[]
  onChange: (values: string[]) => void
  options: MultiSelectOption[]
  placeholder?: string
  id?: string
  className?: string
}

export const MultiSelect = ({
  values,
  onChange,
  options,
  placeholder = "Vyberte",
  id,
  className,
}: MultiSelectProps) => {
  const reduceMotion = useReducedMotion()

  const toggle = (value: string) => {
    onChange(values.includes(value) ? values.filter((item) => item !== value) : [...values, value])
  }

  const selectedLabels = options
    .filter((option) => values.includes(option.value))
    .map((option) => option.label)

  return (
    <PopoverPrimitive.Root>
      <PopoverPrimitive.Trigger
        id={id}
        className={cn(
          "group flex h-11 w-full items-center justify-between gap-2 rounded-xl border border-border-strong/60 bg-surface px-4 text-[15px] transition-[border-color,box-shadow] duration-150 hover:border-border-strong focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50 data-[state=open]:border-primary data-[state=open]:ring-[3px] data-[state=open]:ring-primary/20",
          values.length === 0 ? "text-muted-soft" : "text-foreground",
          className,
        )}
      >
        <span className="truncate text-left">
          {values.length === 0 ? placeholder : selectedLabels.join(", ")}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-soft transition-transform duration-150 group-data-[state=open]:rotate-180" />
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={6}
          className="z-50 max-h-72 w-[var(--radix-popover-trigger-width)] overflow-y-auto rounded-xl border border-hairline bg-surface p-1.5 shadow-lifted outline-none"
          asChild
        >
          <motion.div
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }}
            style={{ transformOrigin: "var(--radix-popover-content-transform-origin)" }}
          >
            {options.length === 0 ? (
              <p className="px-3 py-2 text-sm text-muted">Žádné položky</p>
            ) : (
              options.map((option) => (
                <label
                  key={option.value}
                  className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-foreground transition-colors hover:bg-surface-2"
                >
                  <Checkbox
                    checked={values.includes(option.value)}
                    onCheckedChange={() => toggle(option.value)}
                  />
                  <span className="truncate">{option.label}</span>
                </label>
              ))
            )}
          </motion.div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  )
}
