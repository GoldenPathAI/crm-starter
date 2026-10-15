"use client"

import { useState, type ReactNode } from "react"
import { cn } from "@/lib/cn"

export type ClientTabKey = "prehled" | "aktivita" | "projekty" | "dokumenty"

const TABS: ReadonlyArray<{ key: ClientTabKey; label: string }> = [
  { key: "prehled", label: "Přehled" },
  { key: "aktivita", label: "Aktivita" },
  { key: "projekty", label: "Projekty" },
  { key: "dokumenty", label: "Dokumenty" },
]

interface ClientTabsProps {
  initialTab: ClientTabKey
  panels: Record<ClientTabKey, ReactNode>
}

export function ClientTabs({ initialTab, panels }: ClientTabsProps) {
  const [active, setActive] = useState<ClientTabKey>(initialTab)

  const select = (key: ClientTabKey) => {
    setActive(key)
    const url = new URL(window.location.href)
    if (key === "prehled") {
      url.searchParams.delete("tab")
    } else {
      url.searchParams.set("tab", key)
    }

    window.history.replaceState(null, "", url.toString())
  }

  return (
    <div className="flex flex-col gap-6">
      <div
        role="tablist"
        className="flex items-center gap-1 overflow-x-auto border-b border-hairline [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {TABS.map((tab) => {
          const selected = active === tab.key

          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => select(tab.key)}
              className={cn(
                "relative -mb-px whitespace-nowrap px-4 py-2.5 text-sm font-medium transition-colors",
                selected ? "text-foreground" : "text-muted hover:text-foreground",
              )}
            >
              {tab.label}
              {selected ? (
                <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-primary" />
              ) : null}
            </button>
          )
        })}
      </div>
      <div>{panels[active]}</div>
    </div>
  )
}
