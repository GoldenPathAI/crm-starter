"use client"

import { useMemo, useState, type ReactNode } from "react"
import { Check, ChevronDown, Search } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/app/_ui/Popover"
import { cn } from "@/lib/cn"
import type { TaskOption } from "./types"

interface SearchableSelectProps {
  value: string
  onChange: (value: string) => void
  options: TaskOption[]
  placeholder: string
  emptyLabel?: string
  disabled?: boolean
  align?: "start" | "end"
  renderIcon?: (option: TaskOption) => ReactNode
}

export function SearchableSelect({
  value,
  onChange,
  options,
  placeholder,
  emptyLabel = "Nic nenalezeno",
  disabled,
  align = "start",
  renderIcon,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")

  const selected = options.find((option) => option.value === value) ?? null
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (needle.length === 0) {
      return options
    }
    return options.filter((option) => option.label.toLowerCase().includes(needle))
  }, [options, query])

  const select = (next: string) => {
    onChange(next)
    setOpen(false)
    setQuery("")
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) {
          setQuery("")
        }
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50",
            selected === null ? "text-muted-soft" : "text-foreground",
          )}
        >
          <span className="flex min-w-0 items-center gap-2">
            {selected !== null && renderIcon !== undefined ? renderIcon(selected) : null}
            <span className="truncate">{selected !== null ? selected.label : placeholder}</span>
          </span>
          <ChevronDown className="size-3.5 shrink-0 text-muted-soft" />
        </button>
      </PopoverTrigger>
      <PopoverContent align={align} className="w-64 p-0">
        <div className="flex items-center gap-2 border-b border-hairline px-3 py-2">
          <Search className="size-3.5 shrink-0 text-muted-soft" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Hledat"
            autoFocus
            autoComplete="off"
            className="h-5 w-full bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-soft"
          />
        </div>
        <div className="max-h-60 overflow-y-auto p-1.5">
          {filtered.length === 0 ? (
            <p className="px-2.5 py-2 text-[13px] text-muted-soft">{emptyLabel}</p>
          ) : (
            filtered.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => select(option.value)}
                className={cn(
                  "flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-[13px] transition-colors",
                  option.value === value
                    ? "bg-primary-soft text-primary"
                    : "text-foreground hover:bg-surface-2",
                )}
              >
                <span className="flex min-w-0 items-center gap-2">
                  {renderIcon !== undefined ? renderIcon(option) : null}
                  <span className="truncate">{option.label}</span>
                </span>
                {option.value === value ? <Check className="size-3.5 shrink-0" /> : null}
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
