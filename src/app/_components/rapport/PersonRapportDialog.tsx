"use client"

import { useCallback, useEffect, useState, useTransition, type KeyboardEvent, type ReactNode } from "react"
import { addDays, format, parseISO } from "date-fns"
import { Check, Trash2, X } from "lucide-react"
import { EntityAvatar } from "@/app/_ui/Avatar"
import { ConfirmDialog } from "@/app/_ui/ConfirmDialog"
import { DescriptionEditor } from "@/app/_ui/DescriptionEditor"
import { Dialog, DialogContent, DialogTitle } from "@/app/_ui/Dialog"
import { Popover, PopoverContent, PopoverTrigger } from "@/app/_ui/Popover"
import { Spinner } from "@/app/_ui/Spinner"
import { useToast } from "@/app/_ui/Toast"
import { crmApi } from "@/app/_lib/apiClient"
import { badgeStyleFor, styleMap } from "@/lib/crm/config"
import { cn } from "@/lib/cn"
import { formatCzechDate, todayIso } from "@/lib/dates"
import type { EnumOption, Person, RapportEntry } from "@/core/types/crm.types"

export interface RapportClientOption {
  id: string
  name: string
}

interface PersonRapportDialogProps {
  orgSlug: string
  person: Person
  kindOptions: EnumOption[]
  entryKindOptions: EnumOption[]
  clientOptions: RapportClientOption[]
  open: boolean
  onOpenChange: (open: boolean) => void
  // Called after any persisted change so the surrounding list can refresh.
  onChanged: () => void
  onDeleted?: () => void
}

type PersonPatch = Partial<{
  name: string
  kind: string
  clientId: string | null
  role: string | null
  note: string | null
}>

// Kind filter chips only appear once the timeline is long enough to need them.
const ENTRY_FILTER_THRESHOLD = 8

export function PersonRapportDialog({
  orgSlug,
  person,
  kindOptions,
  entryKindOptions,
  clientOptions,
  open,
  onOpenChange,
  onChanged,
  onDeleted,
}: PersonRapportDialogProps) {
  const { toast } = useToast()
  // The dialog stays responsive while the server round-trips: every field renders
  // from local state, the patch is sent behind it, and the list refreshes after.
  const [draft, setDraft] = useState<Person>(person)
  const [entries, setEntries] = useState<RapportEntry[] | null>(null)

  useEffect(() => {
    setDraft(person)
  }, [person])

  const reloadEntries = useCallback(() => {
    void crmApi<RapportEntry[]>(orgSlug, "GET", `/people/${person.id}/rapport`)
      .then(setEntries)
      .catch((error: unknown) => {
        toast({
          variant: "error",
          title: error instanceof Error ? error.message : "Raport se nepodařilo načíst.",
        })
      })
  }, [orgSlug, person.id, toast])

  useEffect(() => {
    if (!open) {
      return
    }
    setEntries(null)
    reloadEntries()
  }, [open, reloadEntries])

  const savePatch = (patch: PersonPatch): void => {
    setDraft((current) => ({
      ...current,
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.kind !== undefined ? { kind: patch.kind } : {}),
      ...(patch.clientId !== undefined ? { clientId: patch.clientId ?? undefined } : {}),
      ...(patch.role !== undefined ? { role: patch.role ?? undefined } : {}),
      ...(patch.note !== undefined ? { note: patch.note ?? undefined } : {}),
    }))
    void crmApi<Person>(orgSlug, "PATCH", `/people/${person.id}`, { body: patch })
      .then(() => onChanged())
      .catch((error: unknown) => {
        setDraft(person)
        toast({
          variant: "error",
          title: error instanceof Error ? error.message : "Změnu se nepodařilo uložit.",
        })
      })
  }

  const remove = async (): Promise<void> => {
    try {
      await crmApi(orgSlug, "DELETE", `/people/${person.id}`)
      onOpenChange(false)
      onChanged()
      onDeleted?.()
    } catch (error) {
      toast({
        variant: "error",
        title: error instanceof Error ? error.message : "Osobu se nepodařilo smazat.",
      })
    }
  }

  const clientId = draft.clientId ?? null
  const clientKind = kindOptions.find((option) => option.semantic === "client")?.value

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-[760px]"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <DialogTitle className="sr-only">Detail osoby</DialogTitle>
        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-3 pr-8">
            <EntityAvatar name={draft.name} seed={person.id} className="size-9 rounded-lg text-xs" />
            <NameInput
              value={draft.name}
              onCommit={(name) => {
                if (name.length > 0 && name !== draft.name) {
                  savePatch({ name })
                }
              }}
            />
          </div>

          <div className="grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2">
            <PropertyRow label="Typ">
              <KindControl
                value={draft.kind}
                options={kindOptions}
                onSelect={(kind) => savePatch({ kind })}
              />
            </PropertyRow>
            <PropertyRow label="Klient">
              <ClientLinkControl
                options={clientOptions}
                value={clientId}
                onCommit={(nextClientId) =>
                  savePatch({
                    clientId: nextClientId,
                    // Attaching a client makes the person that client's contact.
                    ...(nextClientId !== null && clientKind !== undefined ? { kind: clientKind } : {}),
                  })
                }
              />
            </PropertyRow>
            <PropertyRow label="Role">
              <TextControl
                value={draft.role ?? ""}
                placeholder="Např. jednatel"
                onCommit={(role) => savePatch({ role: role.length > 0 ? role : null })}
              />
            </PropertyRow>
            <PropertyRow label="E-mail">
              <TextControl
                value={draft.email ?? ""}
                placeholder="Nevyplněno"
                onCommit={() => undefined}
                readOnly
              />
            </PropertyRow>
            <PropertyRow label="Telefon">
              <TextControl
                value={draft.phone ?? ""}
                placeholder="Nevyplněno"
                onCommit={() => undefined}
                readOnly
              />
            </PropertyRow>
          </div>

          <div className="h-px bg-border" />

          <div className="flex flex-col gap-2">
            <h3 className="text-[13px] font-semibold text-foreground">Profil</h3>
            <DescriptionEditor
              value={draft.note ?? ""}
              onCommit={(note) => savePatch({ note: note.trim().length > 0 ? note : null })}
              placeholder="Kdo to je, co je pro něj důležité…"
            />
          </div>

          <div className="h-px bg-border" />

          <EntriesSection
            orgSlug={orgSlug}
            personId={person.id}
            entries={entries}
            entryKindOptions={entryKindOptions}
            onChanged={() => {
              reloadEntries()
              onChanged()
            }}
          />

          <div className="h-px bg-border" />

          <div className="flex items-center justify-between gap-2">
            <ConfirmDialog
              trigger={
                <button
                  type="button"
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1.5 text-[13px] text-muted transition-colors hover:bg-danger-soft hover:text-danger"
                >
                  <Trash2 className="size-3.5" />
                  Smazat osobu
                </button>
              }
              title="Smazat osobu"
              description={`${person.name} bude smazán včetně všech záznamů raportu. Akci nelze vrátit.`}
              confirmLabel="Smazat"
              destructive
              onConfirm={remove}
            />
            <span className="text-[11px] text-muted-soft">
              Přidán {formatCzechDate(person.createdAt.slice(0, 10))}
            </span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function PropertyRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[92px_1fr] items-center gap-2">
      <span className="text-[13px] text-muted-soft">{label}</span>
      <div className="min-w-0">{children}</div>
    </div>
  )
}

function NameInput({ value, onCommit }: { value: string; onCommit: (value: string) => void }) {
  const [local, setLocal] = useState(value)

  useEffect(() => {
    setLocal(value)
  }, [value])

  return (
    <input
      value={local}
      onChange={(event) => setLocal(event.target.value)}
      onBlur={() => onCommit(local.trim())}
      onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === "Enter") {
          event.preventDefault()
          event.currentTarget.blur()
        }
      }}
      placeholder="Jméno osoby"
      autoComplete="off"
      aria-label="Jméno osoby"
      className="w-full bg-transparent font-display text-2xl font-semibold tracking-tight text-foreground outline-none placeholder:text-muted-soft"
    />
  )
}

function TextControl({
  value,
  placeholder,
  onCommit,
  readOnly,
}: {
  value: string
  placeholder: string
  onCommit: (value: string) => void
  readOnly?: boolean
}) {
  const [local, setLocal] = useState(value)

  useEffect(() => {
    setLocal(value)
  }, [value])

  if (readOnly === true) {
    return (
      <span
        className={cn(
          "block truncate px-2 py-1 text-[13px]",
          value.length > 0 ? "text-foreground" : "text-muted-soft",
        )}
      >
        {value.length > 0 ? value : placeholder}
      </span>
    )
  }

  return (
    <input
      value={local}
      onChange={(event) => setLocal(event.target.value)}
      onBlur={() => {
        const trimmed = local.trim()
        if (trimmed !== value) {
          onCommit(trimmed)
        }
      }}
      onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === "Enter") {
          event.preventDefault()
          event.currentTarget.blur()
        }
      }}
      placeholder={placeholder}
      autoComplete="off"
      className="h-7 w-full rounded-lg bg-transparent px-2 text-[13px] text-foreground outline-none transition-colors placeholder:text-muted-soft hover:bg-surface-2 focus:bg-surface-2"
    />
  )
}

function KindControl({
  value,
  options,
  onSelect,
}: {
  value: string
  options: EnumOption[]
  onSelect: (value: string) => void
}) {
  const [open, setOpen] = useState(false)
  const styles = styleMap(options)
  const active = badgeStyleFor(value, styles)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1 transition-colors hover:bg-surface-2"
          aria-label="Změnit typ osoby"
        >
          <span
            className={cn(
              "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium",
              active.badge,
            )}
          >
            <span aria-hidden className={cn("size-1.5 shrink-0 rounded-full", active.dot)} />
            {active.label}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-1">
        <div className="flex min-w-44 flex-col gap-0.5">
          {options.map((option) => {
            const style = badgeStyleFor(option.value, styles)
            const selected = option.value === value
            return (
              <button
                key={option.value}
                type="button"
                disabled={selected}
                onClick={() => {
                  setOpen(false)
                  onSelect(option.value)
                }}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[13px] transition-colors",
                  selected
                    ? "cursor-default text-muted-soft"
                    : "cursor-pointer text-foreground hover:bg-surface-2",
                )}
              >
                <span aria-hidden className={cn("size-[7px] shrink-0 rounded-full", style.dot)} />
                <span className="flex-1 truncate">{option.label}</span>
                {selected ? <Check className="size-3.5 shrink-0 text-muted-soft" /> : null}
              </button>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}

function ClientLinkControl({
  options,
  value,
  onCommit,
}: {
  options: RapportClientOption[]
  value: string | null
  onCommit: (clientId: string | null) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const selected = options.find((option) => option.id === value)

  const needle = query.trim().toLowerCase()
  const filtered =
    needle.length === 0
      ? options
      : options.filter((option) => option.name.toLowerCase().includes(needle))

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
          className={cn(
            "block h-7 w-full cursor-pointer truncate rounded-lg px-2 text-left text-[13px] transition-colors hover:bg-surface-2",
            selected !== undefined ? "text-foreground" : "text-muted-soft",
          )}
        >
          {selected?.name ?? "Propojit s klientem"}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-1.5">
        <input
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Hledat klienta"
          className="mb-1 w-full rounded-lg border border-primary/40 bg-surface px-2 py-1 text-[13px] text-foreground outline-none"
        />
        <div className="flex max-h-56 flex-col gap-0.5 overflow-y-auto">
          {filtered.map((option) => {
            const active = option.id === value
            return (
              <button
                key={option.id}
                type="button"
                disabled={active}
                onClick={() => {
                  setOpen(false)
                  onCommit(option.id)
                }}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[13px] transition-colors",
                  active
                    ? "cursor-default text-muted-soft"
                    : "cursor-pointer text-foreground hover:bg-surface-2",
                )}
              >
                <span className="flex-1 truncate">{option.name}</span>
                {active ? <Check className="size-3.5 shrink-0 text-muted-soft" /> : null}
              </button>
            )
          })}
          {filtered.length === 0 ? (
            <span className="px-2.5 py-1.5 text-[13px] text-muted-soft">Žádný klient</span>
          ) : null}
        </div>
        {value !== null ? (
          <button
            type="button"
            onClick={() => {
              setOpen(false)
              onCommit(null)
            }}
            className="mt-1 w-full cursor-pointer rounded-lg px-2.5 py-1.5 text-left text-[13px] text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
          >
            Zrušit propojení
          </button>
        ) : null}
      </PopoverContent>
    </Popover>
  )
}

const entryDateIso = (entry: RapportEntry): string =>
  (entry.happenedAt ?? entry.createdAt).slice(0, 10)

const dayLabel = (iso: string): string => {
  const today = todayIso()
  if (iso === today) {
    return "Dnes"
  }
  if (iso === format(addDays(parseISO(today), -1), "yyyy-MM-dd")) {
    return "Včera"
  }
  return formatCzechDate(iso)
}

interface EntryDayGroup {
  date: string
  rows: RapportEntry[]
}

// The API orders by createdAt, but the timeline reads by the day the thing happened
// (happenedAt when set), so re-sort before collapsing same-day entries under one header.
const groupEntriesByDay = (rows: RapportEntry[]): EntryDayGroup[] => {
  const sorted = [...rows].sort((a, b) => {
    const byDay = entryDateIso(b).localeCompare(entryDateIso(a))
    return byDay !== 0 ? byDay : b.createdAt.localeCompare(a.createdAt)
  })
  return sorted.reduce<EntryDayGroup[]>((groups, entry) => {
    const date = entryDateIso(entry)
    const last = groups[groups.length - 1]
    return last !== undefined && last.date === date
      ? [...groups.slice(0, -1), { date, rows: [...last.rows, entry] }]
      : [...groups, { date, rows: [entry] }]
  }, [])
}

function EntriesSection({
  orgSlug,
  personId,
  entries,
  entryKindOptions,
  onChanged,
}: {
  orgSlug: string
  personId: string
  entries: RapportEntry[] | null
  entryKindOptions: EnumOption[]
  onChanged: () => void
}) {
  const { toast } = useToast()
  const styles = styleMap(entryKindOptions)
  const defaultKind = entryKindOptions[0]?.value ?? ""
  const [kind, setKind] = useState(defaultKind)
  const [content, setContent] = useState("")
  const [filter, setFilter] = useState<string | null>(null)
  const [submitting, startSubmit] = useTransition()

  useEffect(() => {
    setKind(defaultKind)
  }, [defaultKind])

  const submit = (): void => {
    const trimmed = content.trim()
    if (trimmed.length === 0 || submitting) {
      return
    }
    startSubmit(async () => {
      try {
        await crmApi(orgSlug, "POST", `/people/${personId}/rapport`, {
          body: { content: trimmed, kind },
        })
        setContent("")
        onChanged()
      } catch (error) {
        toast({
          variant: "error",
          title: error instanceof Error ? error.message : "Záznam se nepodařilo uložit.",
        })
      }
    })
  }

  const removeEntry = (id: string): void => {
    void crmApi(orgSlug, "DELETE", `/rapport-entries/${id}`)
      .then(() => onChanged())
      .catch((error: unknown) => {
        toast({
          variant: "error",
          title: error instanceof Error ? error.message : "Záznam se nepodařilo smazat.",
        })
      })
  }

  const showFilter = entries !== null && entries.length >= ENTRY_FILTER_THRESHOLD
  const visible =
    entries === null
      ? null
      : filter === null
        ? entries
        : entries.filter((entry) => entry.kind === filter)
  const groups = visible === null ? [] : groupEntriesByDay(visible)

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-[13px] font-semibold text-foreground">Raport</h3>
        {entries !== null && entries.length > 0 ? (
          <span className="rounded-full bg-surface-3/70 px-2 py-0.5 text-[11px] font-medium tabular-nums text-muted">
            {entries.length}
          </span>
        ) : null}
        {entries === null ? <Spinner className="size-3.5 text-muted-soft" /> : null}
        {showFilter ? (
          <div className="ml-auto flex items-center gap-1">
            <FilterChip active={filter === null} onClick={() => setFilter(null)}>
              Vše
            </FilterChip>
            {entryKindOptions.map((option) => {
              const count = entries.filter((entry) => entry.kind === option.value).length
              if (count === 0) {
                return null
              }
              const style = badgeStyleFor(option.value, styles)
              return (
                <FilterChip
                  key={option.value}
                  active={filter === option.value}
                  onClick={() => setFilter(filter === option.value ? null : option.value)}
                >
                  <span aria-hidden className={cn("size-[7px] shrink-0 rounded-full", style.dot)} />
                  {option.label}
                  <span className="tabular-nums text-muted-soft">{count}</span>
                </FilterChip>
              )
            })}
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5 rounded-xl border border-hairline p-2.5">
        <div className="flex items-center gap-1">
          {entryKindOptions.map((option) => {
            const style = badgeStyleFor(option.value, styles)
            const active = option.value === kind
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setKind(option.value)}
                className={cn(
                  "inline-flex cursor-pointer items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors",
                  active ? style.badge : "text-muted hover:bg-surface-2",
                )}
              >
                <span aria-hidden className={cn("size-[7px] shrink-0 rounded-full", style.dot)} />
                {option.label}
              </button>
            )
          })}
        </div>
        <textarea
          rows={2}
          value={content}
          placeholder="Např. syn Tomáš (8), o víkendech jezdí na kole, řeší nový sklad…"
          onChange={(event) => setContent(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
              event.preventDefault()
              submit()
            }
          }}
          className="w-full resize-none bg-transparent text-[13px] leading-relaxed text-foreground outline-none placeholder:text-muted-soft"
        />
        <div className="flex justify-end">
          <button
            type="button"
            onClick={submit}
            disabled={submitting || content.trim().length === 0}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-primary px-2.5 py-1 text-[12px] font-medium text-white transition-opacity disabled:cursor-default disabled:opacity-40"
          >
            {submitting ? <Spinner className="size-3.5" /> : null}
            Přidat záznam
          </button>
        </div>
      </div>

      {entries !== null && entries.length === 0 ? (
        <p className="px-1 text-[12px] text-muted-soft">
          Zatím žádné záznamy. Sem patří drobnosti, na kterých se staví důvěra.
        </p>
      ) : null}

      {visible !== null && visible.length === 0 && entries !== null && entries.length > 0 ? (
        <p className="px-1 text-[12px] text-muted-soft">Žádný záznam tohoto typu.</p>
      ) : null}

      {groups.length > 0 ? (
        <div className="flex flex-col gap-3">
          {groups.map((group) => (
            <div key={group.date} className="flex flex-col gap-0.5">
              <div className="flex items-center gap-2.5 px-2 pb-1">
                <span className="whitespace-nowrap text-[11px] font-semibold uppercase tracking-wide tabular-nums text-muted-soft">
                  {dayLabel(group.date)}
                </span>
                <span aria-hidden className="h-px flex-1 bg-border" />
              </div>
              {group.rows.map((entry) => {
                const style = badgeStyleFor(entry.kind, styles)
                return (
                  <div
                    key={entry.id}
                    className="group flex items-start gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-surface-2"
                  >
                    <span className="w-[88px] shrink-0 pt-0.5">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium",
                          style.badge,
                        )}
                      >
                        <span
                          aria-hidden
                          className={cn("size-[7px] shrink-0 rounded-full", style.dot)}
                        />
                        {style.label}
                      </span>
                    </span>
                    <span className="min-w-0 flex-1 whitespace-pre-wrap text-[13px] leading-relaxed text-foreground">
                      {entry.content}
                    </span>
                    <button
                      type="button"
                      aria-label="Smazat záznam"
                      onClick={() => removeEntry(entry.id)}
                      className="invisible shrink-0 cursor-pointer pt-0.5 text-muted-soft transition-colors hover:text-danger group-hover:visible"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex cursor-pointer items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors",
        active ? "bg-surface-3 text-foreground" : "text-muted hover:bg-surface-2",
      )}
    >
      {children}
    </button>
  )
}
