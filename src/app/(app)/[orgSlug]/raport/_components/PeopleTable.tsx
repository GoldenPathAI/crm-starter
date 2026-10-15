"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { HeartHandshake, Users } from "lucide-react"
import { Browser } from "@/app/_components/browser/Browser"
import type {
  BrowserColumn,
  BrowserFilterOption,
  BrowserGroupConfig,
  BrowserPreset,
} from "@/app/_components/browser/types"
import {
  PersonRapportDialog,
  type RapportClientOption,
} from "@/app/_components/rapport/PersonRapportDialog"
import { EntityAvatar } from "@/app/_ui/Avatar"
import { badgeStyleFor, styleMap } from "@/lib/crm/config"
import { cn } from "@/lib/cn"
import { SortDirection } from "@/core/types/query.types"
import type { EnumOption } from "@/core/types/crm.types"
import type { PersonWithRapport } from "@/lib/crm/store/people"
import { RAPPORT_GROUP_MAX_LEVELS, type RaportGroupField } from "../_lib/parseRaportQuery"

interface PeopleTableProps {
  orgSlug: string
  rows: PersonWithRapport[]
  kinds: string[]
  search: string
  sortField: string | undefined
  sortDir: SortDirection
  groups: RaportGroupField[]
  kindOptions: EnumOption[]
  entryKindOptions: EnumOption[]
  clientOptions: RapportClientOption[]
}

const cellText = "text-[13px]"

export function PeopleTable({
  orgSlug,
  rows,
  kinds,
  search,
  sortField,
  sortDir,
  groups,
  kindOptions,
  entryKindOptions,
  clientOptions,
}: PeopleTableProps) {
  const router = useRouter()
  const [openPersonId, setOpenPersonId] = useState<string | null>(null)
  const kindStyles = styleMap(kindOptions)

  const kindFilterOptions: BrowserFilterOption[] = kindOptions.map((option) => ({
    value: option.value,
    label: option.label,
    dotClassName: badgeStyleFor(option.value, kindStyles).dot,
  }))

  const columns: BrowserColumn<PersonWithRapport>[] = [
    {
      id: "name",
      header: "Osoba",
      sortField: "name",
      cell: (row) => (
        <div className="group flex min-w-0 max-w-[280px] items-center gap-2">
          <EntityAvatar name={row.name} seed={row.id} />
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-[13px] font-medium text-foreground transition-colors group-hover:text-primary">
              {row.name}
            </span>
            {row.role !== undefined ? (
              <span title={row.role} className="truncate text-[11px] text-muted-soft">
                {row.role}
              </span>
            ) : null}
          </span>
        </div>
      ),
    },
    {
      id: "kind",
      header: "Typ",
      filter: {
        kind: "checkbox",
        paramKey: "kind",
        label: "Typ",
        options: kindFilterOptions,
        selected: kinds,
      },
      cell: (row) => {
        const style = badgeStyleFor(row.kind, kindStyles)

        return (
          <span
            className={cn(
              "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium",
              style.badge,
            )}
          >
            <span aria-hidden className={cn("size-[7px] shrink-0 rounded-full", style.dot)} />
            {style.label}
          </span>
        )
      },
    },
    {
      id: "client",
      header: "Klient",
      cellClassName: cellText,
      cell: (row) =>
        row.clientName !== undefined ? (
          <span className="block max-w-[220px] truncate text-foreground">{row.clientName}</span>
        ) : (
          <span className="text-muted-soft">-</span>
        ),
    },
    {
      id: "note",
      header: "Profil",
      cellClassName: cellText,
      cell: (row) =>
        row.note !== undefined && row.note.length > 0 ? (
          <span title={row.note} className="block max-w-[320px] truncate text-muted">
            {row.note}
          </span>
        ) : (
          <span className="text-muted-soft">-</span>
        ),
    },
    {
      id: "entries",
      header: "Záznamů",
      sortField: "lastEntryAt",
      cellClassName: cn("tabular-nums", cellText),
      cell: (row) =>
        row.entryCount > 0 ? (
          <span className="text-foreground">{row.entryCount}</span>
        ) : (
          <span className="text-muted-soft">0</span>
        ),
    },
  ]

  const presets: BrowserPreset[] = [
    {
      key: "cold",
      label: "Nejdéle bez záznamu",
      icon: HeartHandshake,
      params: { sortField: "lastEntryAt", sortDir: SortDirection.Asc },
    },
  ]

  const group: BrowserGroupConfig<PersonWithRapport> = {
    current: groups,
    maxLevels: RAPPORT_GROUP_MAX_LEVELS,
    clearsToNone: true,
    options: [
      { value: "kind", label: "Typ" },
      { value: "client", label: "Klient" },
    ],
    build: (list, field) => buildGroups(list, field as RaportGroupField, kindOptions, kindStyles),
  }

  const openPerson = rows.find((row) => row.id === openPersonId)

  return (
    <>
      <Browser
        rows={rows}
        total={rows.length}
        page={1}
        pageSize={rows.length > 0 ? rows.length : 1}
        rowKey={(row) => row.id}
        columns={columns}
        sort={sortField !== undefined ? { field: sortField, direction: sortDir } : undefined}
        searchValue={search}
        searchPlaceholder="Hledat osoby"
        searchAriaLabel="Hledat osoby"
        presets={presets}
        group={group}
        onRowClick={(row) => setOpenPersonId(row.id)}
        empty={{
          icon: <Users className="size-6" />,
          title: "Zatím žádné osoby",
          description: "Přidej člověka, se kterým stavíš dlouhodobý vztah.",
        }}
        emptyFiltered={{
          icon: <Users className="size-6" />,
          title: "Žádné výsledky",
          description: "Zadanému hledání ani filtrům neodpovídá žádná osoba.",
        }}
      />
      {openPerson !== undefined ? (
        <PersonRapportDialog
          orgSlug={orgSlug}
          person={openPerson}
          kindOptions={kindOptions}
          entryKindOptions={entryKindOptions}
          clientOptions={clientOptions}
          open
          onOpenChange={(next) => {
            if (!next) {
              setOpenPersonId(null)
            }
          }}
          onChanged={() => router.refresh()}
          onDeleted={() => setOpenPersonId(null)}
        />
      ) : null}
    </>
  )
}

function buildGroups(
  rows: PersonWithRapport[],
  field: RaportGroupField,
  kindOptions: EnumOption[],
  kindStyles: Record<string, { label: string; dot: string; badge: string }>,
) {
  if (field === "kind") {
    return kindOptions
      .map((option) => ({
        key: option.value,
        label: option.label,
        dotClassName: badgeStyleFor(option.value, kindStyles).dot,
        rows: rows.filter((row) => row.kind === option.value),
      }))
      .filter((bucket) => bucket.rows.length > 0)
  }

  const names = [...new Set(rows.map((row) => row.clientName ?? ""))]
    .filter((name) => name.length > 0)
    .sort((a, b) => a.localeCompare(b, "cs"))
  const buckets = names.map((name) => ({
    key: name,
    label: name,
    rows: rows.filter((row) => row.clientName === name),
  }))
  const unlinked = rows.filter((row) => row.clientName === undefined)

  return unlinked.length > 0
    ? [...buckets, { key: "__none", label: "Bez klienta", rows: unlinked }]
    : buckets
}
