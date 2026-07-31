"use client"

import { useEffect, useState } from "react"
import { Star } from "lucide-react"
import { cn } from "@/lib/cn"
import {
  recordRecentItemAction,
  togglePinnedClientAction,
} from "@/app/_lib/personalizationActions"

interface ClientPinButtonProps {
  orgSlug: string
  clientId: string
  clientName: string
  initialPinned: boolean
}

export function ClientPinButton({
  orgSlug,
  clientId,
  clientName,
  initialPinned,
}: ClientPinButtonProps) {
  const href = `/klienti/${clientId}`
  // Server-resolved on first paint, so no flash: initialPinned comes from the RSC page.
  const [pinned, setPinned] = useState(initialPinned)

  useEffect(() => {
    void recordRecentItemAction(orgSlug, {
      itemType: "client",
      entityId: clientId,
      title: clientName,
      href,
    })
  }, [orgSlug, clientId, clientName, href])

  const label = pinned ? "Odepnout" : "Připnout"

  const toggle = (): void => {
    const next = !pinned
    setPinned(next)
    void togglePinnedClientAction(orgSlug, { clientId, href })
      .then((result) => {
        if (result.status === "error") {
          setPinned(!next)
        } else if (result.pinned !== undefined) {
          setPinned(result.pinned)
        }
      })
      .catch(() => setPinned(!next))
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      aria-pressed={pinned}
      title={label}
      className={cn(
        "flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors",
        pinned ? "text-primary" : "text-muted-soft hover:bg-surface-3/60 hover:text-foreground",
      )}
    >
      <Star className={cn("size-4", pinned && "fill-current")} />
    </button>
  )
}
