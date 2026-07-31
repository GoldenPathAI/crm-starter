"use client"

import { useState, type ReactNode } from "react"
import { Check, Search, X } from "lucide-react"
import type { OrgMember } from "@/core/types/crm.types"
import { Avatar } from "@/app/_ui/Avatar"
import { Popover, PopoverContent, PopoverTrigger } from "@/app/_ui/Popover"
import { cn } from "@/lib/cn"

interface AssigneePickerProps {
  members: OrgMember[]
  selected: string[]
  onToggle: (userId: string) => void
  onClear: () => void
  trigger: ReactNode
  align?: "start" | "end"
}

const SEARCH_THRESHOLD = 8

export function AssigneePicker({
  members,
  selected,
  onToggle,
  onClear,
  trigger,
  align = "start",
}: AssigneePickerProps) {
  const [query, setQuery] = useState("")
  const showSearch = members.length > SEARCH_THRESHOLD
  const needle = query.trim().toLowerCase()
  const filtered =
    needle.length > 0
      ? members.filter((member) => `${member.name} ${member.email}`.toLowerCase().includes(needle))
      : members
  const selectedSet = new Set(selected)

  return (
    <Popover
      onOpenChange={(open) => {
        if (!open) {
          setQuery("")
        }
      }}
    >
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align={align} className="w-64 p-1.5" onClick={(event) => event.stopPropagation()}>
        {showSearch ? (
          <div className="mb-1 flex items-center gap-2 rounded-lg border border-border-strong/60 px-2.5 py-1.5">
            <Search className="size-3.5 shrink-0 text-muted-soft" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Hledat člena"
              autoFocus
              autoComplete="off"
              className="w-full bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-soft"
            />
          </div>
        ) : null}
        <div className="flex max-h-64 flex-col gap-0.5 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="px-2.5 py-2 text-[13px] text-muted-soft">Nikdo nenalezen</p>
          ) : (
            filtered.map((member) => {
              const active = selectedSet.has(member.userId)
              return (
                <button
                  key={member.userId}
                  type="button"
                  onClick={() => onToggle(member.userId)}
                  className={cn(
                    "flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-surface-2",
                    active && "bg-primary-soft/50",
                  )}
                >
                  <Avatar name={member.name} userId={member.userId} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium text-foreground">
                      {member.name}
                    </span>
                    <span className="block truncate text-[11px] text-muted-soft">{member.email}</span>
                  </span>
                  {active ? <Check className="size-4 shrink-0 text-primary" /> : null}
                </button>
              )
            })
          )}
        </div>
        <div className="mt-1 border-t border-hairline pt-1">
          <button
            type="button"
            onClick={onClear}
            disabled={selected.length === 0}
            className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] text-muted transition-colors hover:bg-surface-2 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
          >
            <X className="size-3.5" />
            Vyčistit
          </button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
