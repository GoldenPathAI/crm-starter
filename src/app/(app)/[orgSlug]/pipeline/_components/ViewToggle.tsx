"use client"

import { useTransition } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Columns3, List } from "lucide-react"
import { cn } from "@/lib/cn"
import type { PipelineView } from "../_lib/listQuery"

const options: Array<{ value: PipelineView; label: string; icon: typeof List }> = [
  { value: "kanban", label: "Kanban", icon: Columns3 },
  { value: "list", label: "Seznam", icon: List },
]

export function ViewToggle({ view }: { view: PipelineView }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()

  const select = (next: PipelineView) => {
    if (next === view) {
      return
    }

    const params = new URLSearchParams(searchParams.toString())
    if (next === "kanban") {
      params.delete("view")
    } else {
      params.set("view", next)
    }

    const queryString = params.toString()
    startTransition(() => {
      router.push(queryString.length > 0 ? `${pathname}?${queryString}` : pathname)
    })
  }

  return (
    <div role="tablist" className="inline-flex items-center gap-1 rounded-full border border-hairline bg-surface-2 p-1">
      {options.map((option) => {
        const active = option.value === view
        const Icon = option.icon

        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            onClick={() => select(option.value)}
            aria-selected={active}
            className={cn(
              "inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors duration-150",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
              active ? "bg-surface text-foreground shadow-soft" : "text-muted hover:text-foreground",
            )}
          >
            <Icon className="size-3.5" />
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
