"use client"

import { useMemo, useState } from "react"
import { Check, ChevronDown, Search } from "lucide-react"
import { EntityAvatar } from "@/app/_ui/Avatar"
import { Popover, PopoverContent, PopoverTrigger } from "@/app/_ui/Popover"
import { cn } from "@/lib/cn"
import type { ClientOption } from "@/lib/crm/store/deals"

interface ClientComboboxProps {
  options: ClientOption[]
  value: string
  onChange: (id: string) => void
  id?: string
  placeholder?: string
  invalid?: boolean
}

export function ClientCombobox({
  options,
  value,
  onChange,
  id,
  placeholder = "Vyberte klienta",
  invalid = false,
}: ClientComboboxProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")

  const selected = options.find((option) => option.id === value)
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (needle.length === 0) {
      return options
    }
    return options.filter((option) => option.name.toLowerCase().includes(needle))
  }, [options, query])

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
      <PopoverTrigger
        id={id}
        type="button"
        className={cn(
          "group flex h-11 w-full cursor-pointer items-center justify-between gap-2 rounded-xl border border-border-strong/60 bg-surface px-4 text-[15px] transition-[border-color,box-shadow] duration-150 hover:border-border-strong focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/20 data-[state=open]:border-primary data-[state=open]:ring-[3px] data-[state=open]:ring-primary/20",
          selected === undefined ? "text-muted-soft" : "text-foreground",
          invalid && "border-danger",
        )}
      >
        <span className="flex min-w-0 items-center gap-2 text-left">
          {selected !== undefined ? (
            <EntityAvatar name={selected.name} seed={selected.id} className="size-6 rounded-lg text-[10px]" />
          ) : null}
          <span className="truncate">{selected?.name ?? placeholder}</span>
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-soft transition-transform duration-150 group-data-[state=open]:rotate-180" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-0">
        <div className="flex items-center gap-2 border-b border-hairline px-3">
          <Search className="h-4 w-4 shrink-0 text-muted-soft" />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Hledat klienta"
            className="h-10 w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-soft"
          />
        </div>
        <div className="max-h-56 overflow-y-auto p-1.5">
          {filtered.length === 0 ? (
            <p className="px-3 py-2 text-sm text-muted">Žádný klient</p>
          ) : (
            filtered.map((option) => {
              const active = option.id === value
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => {
                    onChange(option.id)
                    setOpen(false)
                    setQuery("")
                  }}
                  className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-surface-2"
                >
                  <EntityAvatar name={option.name} seed={option.id} className="size-6 rounded-lg text-[10px]" />
                  <span className={cn("flex-1 truncate", active && "font-medium")}>
                    {option.name}
                  </span>
                  {active ? <Check className="h-4 w-4 shrink-0 text-primary" /> : null}
                </button>
              )
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
