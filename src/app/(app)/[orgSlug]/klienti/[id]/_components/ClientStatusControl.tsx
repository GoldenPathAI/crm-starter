"use client"

import { useOptimistic, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Check, ChevronDown } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/app/_ui/Popover"
import { useToast } from "@/app/_ui/Toast"
import { cn } from "@/lib/cn"
import { useOrg } from "@/app/_components/org/OrgProvider"
import type { ClientStatus } from "@/core/types/crm.types"
import { badgeFor, type EnumView } from "../../_lib/enums"
import { updateClientStatusAction } from "../actions"

interface ClientStatusControlProps {
  clientId: string
  status: ClientStatus
  statusView: EnumView
}

export function ClientStatusControl({ clientId, status, statusView }: ClientStatusControlProps) {
  const { orgSlug } = useOrg()
  const router = useRouter()
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [, startTransition] = useTransition()
  // The pill swaps instantly; the optimistic value holds until router.refresh
  // delivers the persisted status, or auto-reverts when the action fails.
  const [optimisticStatus, setOptimisticStatus] = useOptimistic(status)
  const current = badgeFor(statusView, optimisticStatus)

  const change = (next: string) => {
    setOpen(false)
    if (next === optimisticStatus) {
      return
    }

    startTransition(async () => {
      setOptimisticStatus(next)
      const result = await updateClientStatusAction(orgSlug, clientId, next)
      if (result.status === "success") {
        router.refresh()
      } else if (result.status === "error") {
        toast({ variant: "error", title: result.message })
      }
    })
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Změnit status klienta"
          className={cn(
            "inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium transition-opacity hover:opacity-80",
            current.badge,
          )}
        >
          <span aria-hidden className={cn("size-[7px] shrink-0 rounded-full", current.dot)} />
          {current.label}
          <ChevronDown className="size-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-44">
        {statusView.options.map((option) => {
          const style = badgeFor(statusView, option.value)
          const selected = option.value === optimisticStatus

          return (
            <button
              key={option.value}
              type="button"
              onClick={() => change(option.value)}
              className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-sm text-foreground transition-colors hover:bg-surface-2"
            >
              <span className="flex items-center gap-2">
                <span aria-hidden className={cn("size-[7px] shrink-0 rounded-full", style.dot)} />
                {style.label}
              </span>
              {selected ? <Check className="size-4 text-primary" /> : null}
            </button>
          )
        })}
      </PopoverContent>
    </Popover>
  )
}
