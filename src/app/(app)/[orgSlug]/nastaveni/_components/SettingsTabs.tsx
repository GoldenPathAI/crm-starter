"use client"

import { useState, type ReactNode } from "react"
import { cn } from "@/lib/cn"
import type { SettingsTabKey } from "./settingsTabKeys"

const TABS: ReadonlyArray<{ key: SettingsTabKey; label: string }> = [
  { key: "clenove", label: "Členové" },
  { key: "ciselniky", label: "Číselníky" },
  { key: "organizace", label: "Organizace" },
  { key: "data", label: "Data" },
  { key: "historie", label: "Historie" },
]

interface SettingsTabsProps {
  initialTab: SettingsTabKey
  panels: Record<SettingsTabKey, ReactNode>
}

export function SettingsTabs({ initialTab, panels }: SettingsTabsProps) {
  const [active, setActive] = useState<SettingsTabKey>(initialTab)

  const select = (key: SettingsTabKey) => {
    setActive(key)
    const url = new URL(window.location.href)
    if (key === "clenove") {
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
                "relative -mb-px cursor-pointer whitespace-nowrap px-4 py-2.5 text-sm font-medium transition-colors",
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
