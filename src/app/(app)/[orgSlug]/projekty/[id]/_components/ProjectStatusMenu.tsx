"use client"

import { useState, useTransition } from "react"
import { Check, ChevronDown } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/app/_ui/Popover"
import { useToast } from "@/app/_ui/Toast"
import { useOrg } from "@/app/_components/org/OrgProvider"
import { badgeStyleFor, optionBadgeStyle, styleMap } from "@/lib/crm/config"
import { cn } from "@/lib/cn"
import type { EnumOption, Project } from "@/core/types/crm.types"
import { changeProjectStatusAction } from "../actions"

export function ProjectStatusMenu({
  project,
  statusOptions,
}: {
  project: Project
  statusOptions: EnumOption[]
}) {
  const { toast } = useToast()
  const { orgSlug } = useOrg()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const style = badgeStyleFor(project.status, styleMap(statusOptions))

  const select = (status: string) => {
    setOpen(false)
    if (status === project.status) {
      return
    }
    startTransition(async () => {
      const result = await changeProjectStatusAction(orgSlug, { projectId: project.id, status })
      toast({
        variant: result.status === "success" ? "success" : "error",
        title: result.status === "idle" ? undefined : result.message,
      })
    })
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Změnit stav projektu"
          disabled={isPending}
          className={cn(
            "inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-[13px] font-medium transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/20",
            style.badge,
            isPending && "opacity-60",
          )}
        >
          <span aria-hidden className={cn("size-2 shrink-0 rounded-full", style.dot)} />
          {style.label}
          <ChevronDown className="size-3.5 opacity-70" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-auto p-1">
        <div className="flex min-w-48 flex-col gap-0.5">
          <span className="px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-muted-soft">
            Změnit stav
          </span>
          {statusOptions.map((option) => {
            const item = optionBadgeStyle(option)
            const active = option.value === project.status
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => select(option.value)}
                className={cn(
                  "flex cursor-pointer items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors",
                  active ? "bg-primary-soft text-primary" : "text-foreground hover:bg-surface-2",
                )}
              >
                <span className="flex items-center gap-2">
                  <span aria-hidden className={cn("size-[7px] rounded-full", item.dot)} />
                  {item.label}
                </span>
                {active ? <Check className="size-4 shrink-0" /> : null}
              </button>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}
