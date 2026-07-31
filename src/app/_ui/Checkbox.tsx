"use client"

import * as CheckboxPrimitive from "@radix-ui/react-checkbox"
import { CheckIcon } from "lucide-react"
import { cn } from "@/lib/cn"

interface CheckboxProps {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  id?: string
  disabled?: boolean
  className?: string
}

export const Checkbox = ({ checked, onCheckedChange, id, disabled, className }: CheckboxProps) => (
  <CheckboxPrimitive.Root
    id={id}
    checked={checked}
    disabled={disabled}
    onCheckedChange={(state) => onCheckedChange(state === true)}
    className={cn(
      "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-border-strong bg-surface transition-[color,border-color,background-color] duration-150 hover:border-primary/50 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/20 data-[state=checked]:border-primary data-[state=checked]:bg-primary disabled:cursor-not-allowed disabled:opacity-50",
      className,
    )}
  >
    <CheckboxPrimitive.Indicator className="flex items-center justify-center">
      <CheckIcon className="h-3.5 w-3.5 text-primary-foreground" />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
)
