"use client"

import { useState } from "react"
import { ChevronDown } from "lucide-react"
import { useClampedOverflow } from "@/app/_lib/useClampedOverflow"
import { cn } from "@/lib/cn"

export function ExpandToggle({ expanded, onToggle }: { expanded: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={expanded}
      className="inline-flex cursor-pointer items-center gap-1 rounded text-[13px] font-medium text-primary transition-colors hover:text-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      {expanded ? "Zobrazit méně" : "Zobrazit celé"}
      <ChevronDown className={cn("size-3.5 transition-transform", expanded && "rotate-180")} />
    </button>
  )
}

export function ExpandableText({
  text,
  lineClamp = "line-clamp-4",
  className,
}: {
  text: string
  lineClamp?: string
  className?: string
}) {
  const [expanded, setExpanded] = useState(false)
  const { ref, overflowing } = useClampedOverflow<HTMLParagraphElement>(expanded, text)

  return (
    <div className="flex flex-col items-start gap-1">
      <p
        ref={ref}
        className={cn("whitespace-pre-wrap break-words", expanded ? undefined : lineClamp, className)}
      >
        {text}
      </p>
      {overflowing || expanded ? (
        <ExpandToggle expanded={expanded} onToggle={() => setExpanded(!expanded)} />
      ) : null}
    </div>
  )
}
