"use client"

import { useState } from "react"
import { ChevronRight } from "lucide-react"
import { Spinner } from "@/app/_ui/Spinner"
import { cn } from "@/lib/cn"
import { HistoryEntryRows, type HistoryItem } from "@/app/_components/HistoryCard"

// Collapsible "Historie" block for client-rendered detail surfaces (deal panel,
// task modal). Entries load lazily through the passed server action on first open.
export function HistorySection({ load }: { load: () => Promise<HistoryItem[]> }) {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<HistoryItem[] | null>(null)

  const toggle = () => {
    const next = !open
    setOpen(next)
    if (next && items === null) {
      void load().then(setItems)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="flex cursor-pointer items-center gap-1.5 text-left text-[13px] font-semibold text-foreground"
      >
        <ChevronRight
          className={cn("size-3.5 shrink-0 text-muted-soft transition-transform", open && "rotate-90")}
        />
        Historie
      </button>
      {open ? (
        items === null ? (
          <div className="flex items-center justify-center py-3">
            <Spinner className="size-4 text-muted-soft" />
          </div>
        ) : (
          <div className="flex flex-col gap-3 pl-5">
            <HistoryEntryRows items={items} />
          </div>
        )
      ) : null}
    </div>
  )
}
