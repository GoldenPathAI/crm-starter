"use client"

import { useState } from "react"
import type { EnumKind, EnumOption } from "@/core/types/crm.types"
import { cn } from "@/lib/cn"
import { Card, CardHeader, CardTitle } from "@/app/_ui/Card"
import { EnumEditor } from "./EnumEditor"

export interface EnumGroup {
  kind: EnumKind
  title: string
  options: EnumOption[]
}

const countActive = (options: EnumOption[]): number =>
  options.filter((option) => option.archivedAt === undefined).length

export function EnumsManager({
  orgSlug,
  groups,
  canEdit,
}: {
  orgSlug: string
  groups: EnumGroup[]
  canEdit: boolean
}) {
  const first = groups[0]
  const [selectedKind, setSelectedKind] = useState<EnumKind | undefined>(first?.kind)
  const selected = groups.find((group) => group.kind === selectedKind) ?? first

  if (selected === undefined) {
    return null
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Číselníky</CardTitle>
      </CardHeader>
      <div className="md:grid md:grid-cols-[240px_minmax(0,1fr)]">
        <div
          role="tablist"
          aria-label="Číselníky"
          className="flex gap-1 overflow-x-auto border-b border-hairline p-3 md:flex-col md:overflow-visible md:border-b-0 md:border-r"
        >
          {groups.map((group) => {
            const isSelected = group.kind === selected.kind
            return (
              <button
                key={group.kind}
                type="button"
                role="tab"
                aria-selected={isSelected}
                onClick={() => setSelectedKind(group.kind)}
                className={cn(
                  "flex shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-left text-[13px] font-medium transition-colors md:w-full md:justify-between",
                  isSelected
                    ? "bg-surface-3/70 text-foreground"
                    : "text-muted hover:bg-surface-3/40 hover:text-foreground",
                )}
              >
                {group.title}
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[11px] font-medium tabular-nums",
                    isSelected ? "bg-surface text-muted" : "bg-surface-3/70 text-muted-soft",
                  )}
                >
                  {countActive(group.options)}
                </span>
              </button>
            )
          })}
        </div>
        <div className="min-w-0 px-6 py-5">
          <EnumEditor
            key={selected.kind}
            orgSlug={orgSlug}
            kind={selected.kind}
            title={selected.title}
            options={selected.options}
            canEdit={canEdit}
          />
        </div>
      </div>
    </Card>
  )
}
