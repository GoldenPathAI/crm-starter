"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

// ClientTabs (klienti/[id]) predates this component and keeps its own copy for now.
interface UrlTabsProps<K extends string> {
  tabs: ReadonlyArray<{ key: K; label: string }>;
  initialTab: K;
  panels: Record<K, ReactNode>;
  paramKey?: string;
}

export function UrlTabs<K extends string>({
  tabs,
  initialTab,
  panels,
  paramKey = "tab",
}: UrlTabsProps<K>) {
  const [active, setActive] = useState<K>(initialTab);
  const defaultTab = tabs[0]?.key;

  const select = (key: K) => {
    setActive(key);
    const url = new URL(window.location.href);
    if (key === defaultTab) {
      url.searchParams.delete(paramKey);
    } else {
      url.searchParams.set(paramKey, key);
    }
    window.history.replaceState(null, "", url.toString());
  };

  return (
    <div className="flex flex-col gap-6">
      <div
        role="tablist"
        className="flex items-center gap-1 overflow-x-auto border-b border-hairline [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {tabs.map((tab) => {
          const selected = active === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => select(tab.key)}
              className={cn(
                "relative -mb-px cursor-pointer whitespace-nowrap px-1.5 py-2.5 text-sm font-medium transition-colors sm:px-4",
                selected ? "text-foreground" : "text-muted hover:text-foreground",
              )}
            >
              {tab.label}
              {selected ? (
                <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-primary" />
              ) : null}
            </button>
          );
        })}
      </div>
      <div>{panels[active]}</div>
    </div>
  );
}
