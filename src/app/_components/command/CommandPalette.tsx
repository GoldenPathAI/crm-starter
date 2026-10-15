"use client"

import * as DialogPrimitive from "@radix-ui/react-dialog"
import { motion, useReducedMotion } from "framer-motion"
import {
  Building2,
  Check,
  CircleDollarSign,
  CornerDownLeft,
  FolderKanban,
  ListChecks,
  Mail,
  Plus,
  Search,
  Star,
  UserPlus,
  type LucideIcon,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react"
import { navItems } from "@/app/_components/navItems"
import { hasPermission } from "@/lib/auth/permissions"
import { useOrg } from "@/app/_components/org/OrgProvider"
import { orgHref } from "@/lib/nav"
import { Kbd } from "@/app/_ui/Kbd"
import { Spinner } from "@/app/_ui/Spinner"
import { useToast } from "@/app/_ui/Toast"
import { useUndoToast } from "@/app/_lib/useUndoToast"
import { cn } from "@/lib/cn"
import {
  assignSelfToTicketCommandAction,
  completeTicketCommandAction,
  searchCommandAction,
} from "@/app/_components/command/actions"
import {
  loadPalettePersonalizationAction,
  recordRecentItemAction,
  togglePinnedClientAction,
} from "@/app/_lib/personalizationActions"
import type { PinnedClient, RecentItem, RecentItemType } from "@/app/_lib/recentItems"
import type { SearchResult, SearchResultType } from "@/lib/crm/store/search"

const OPEN_EVENT = "crm:command-open"

export function openCommandPalette(): void {
  window.dispatchEvent(new Event(OPEN_EVENT))
}

interface PaletteRow {
  key: string
  label: string
  sublabel: string | null
  excerpt: string | null
  icon: LucideIcon
  tile: string
  chipLabel: string | null
  chipClass: string | null
  href: string
  entity: { type: RecentItemType; id: string } | null
}

interface IndexedRow extends PaletteRow {
  flatIndex: number
}

interface PaletteSection {
  heading: string
  rows: IndexedRow[]
}

const NAV_ROWS: ReadonlyArray<PaletteRow> = navItems.map((item) => ({
  key: `nav-${item.href}`,
  label: item.label,
  sublabel: null,
  excerpt: null,
  icon: item.icon,
  tile: item.tileClassName,
  chipLabel: null,
  chipClass: null,
  href: item.href,
  entity: null,
}))

const CREATE_ROWS: ReadonlyArray<PaletteRow> = [
  { key: "new-client", label: "Nový klient", icon: Plus, tile: "bg-indigo", href: "/klienti/novy" },
  { key: "new-project", label: "Nový projekt", icon: Plus, tile: "bg-purple", href: "/projekty/novy" },
  { key: "new-deal", label: "Nový deal", icon: Plus, tile: "bg-teal", href: "/pipeline" },
  { key: "new-ticket", label: "Nový úkol", icon: Plus, tile: "bg-orange", href: "/ukoly" },
].map((row) => ({ ...row, sublabel: null, excerpt: null, chipLabel: null, chipClass: null, entity: null }))

interface ResultGroup {
  type: SearchResultType
  heading: string
  icon: LucideIcon
  tile: string
  chipLabel: string
  chipClass: string
}

const RESULT_GROUPS: ReadonlyArray<ResultGroup> = [
  {
    type: "client",
    heading: "Klienti",
    icon: Building2,
    tile: "bg-indigo",
    chipLabel: "Klient",
    chipClass: "bg-indigo-soft text-indigo-text",
  },
  {
    type: "project",
    heading: "Projekty",
    icon: FolderKanban,
    tile: "bg-purple",
    chipLabel: "Projekt",
    chipClass: "bg-purple-soft text-purple-text",
  },
  {
    type: "ticket",
    heading: "Úkoly",
    icon: ListChecks,
    tile: "bg-orange",
    chipLabel: "Úkol",
    chipClass: "bg-orange-soft text-orange-text",
  },
  {
    type: "deal",
    heading: "Dealy",
    icon: CircleDollarSign,
    tile: "bg-teal",
    chipLabel: "Deal",
    chipClass: "bg-teal-soft text-teal-text",
  },
  {
    type: "email",
    heading: "E-maily",
    icon: Mail,
    tile: "bg-blue",
    chipLabel: "E-mail",
    chipClass: "bg-blue-soft text-blue-text",
  },
]

const normalize = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()

const toResultRow = (result: SearchResult, group: ResultGroup): PaletteRow => ({
  key: `${result.type}-${result.id}`,
  label: result.title,
  sublabel: result.subtitle,
  excerpt: result.excerpt ?? null,
  icon: group.icon,
  tile: group.tile,
  chipLabel: group.chipLabel,
  chipClass: group.chipClass,
  href: result.href,
  entity: result.type === "email" ? null : { type: result.type, id: result.id },
})

const RESULT_GROUP_BY_TYPE = new Map<SearchResultType, ResultGroup>(
  RESULT_GROUPS.map((group) => [group.type, group]),
)

const toPinnedRow = (pin: PinnedClient, group: ResultGroup): PaletteRow => ({
  key: `pin-${pin.id}`,
  label: pin.title,
  sublabel: null,
  excerpt: null,
  icon: group.icon,
  tile: group.tile,
  chipLabel: group.chipLabel,
  chipClass: group.chipClass,
  href: pin.href,
  entity: { type: "client", id: pin.id },
})

const toRecentRow = (item: RecentItem, group: ResultGroup): PaletteRow => ({
  key: `recent-${item.type}-${item.id}`,
  label: item.title,
  sublabel: null,
  excerpt: null,
  icon: group.icon,
  tile: group.tile,
  chipLabel: group.chipLabel,
  chipClass: group.chipClass,
  href: item.href,
  entity: { type: item.type, id: item.id },
})

export function CommandPalette() {
  const router = useRouter()
  const { orgSlug, role } = useOrg()
  const reduceMotion = useReducedMotion()
  const { toast } = useToast()
  const { toastWithUndo } = useUndoToast()

  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [pins, setPins] = useState<PinnedClient[]>([])
  const [recents, setRecents] = useState<RecentItem[]>([])
  const [busyRowKey, setBusyRowKey] = useState<string | null>(null)

  const inputRef = useRef<HTMLInputElement>(null)
  const rowRefs = useRef<Array<HTMLDivElement | null>>([])

  const baseId = useId()
  const listboxId = `${baseId}-listbox`
  const optionId = (flatIndex: number): string => `${baseId}-option-${flatIndex}`
  const groupLabelId = (heading: string): string =>
    `${baseId}-group-${heading.normalize("NFD").replace(/[^a-zA-Z0-9]/g, "")}`

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        setOpen((prev) => !prev)
      }
    }

    const onOpen = (): void => setOpen(true)
    window.addEventListener("keydown", onKey)
    window.addEventListener(OPEN_EVENT, onOpen)

    return () => {
      window.removeEventListener("keydown", onKey)
      window.removeEventListener(OPEN_EVENT, onOpen)
    }
  }, [])

  useEffect(() => {
    if (!open) {
      return
    }

    let active = true
    loadPalettePersonalizationAction(orgSlug)
      .then(({ pins: nextPins, recents: nextRecents }) => {
        if (active) {
          setPins(nextPins)
          setRecents(nextRecents)
        }
      })
      .catch(() => {
        if (active) {
          setPins([])
          setRecents([])
        }
      })

    return () => {
      active = false
    }
  }, [open, orgSlug])

  useEffect(() => {
    const trimmed = query.trim()
    if (trimmed.length < 2) {
      setResults([])
      setLoading(false)

      return
    }

    setLoading(true)
    let active = true
    const timer = setTimeout(() => {
      searchCommandAction(orgSlug, trimmed)
        .then(({ results: next }) => {
          if (active) {
            setResults(next)
          }
        })
        .catch(() => {
          if (active) {
            setResults([])
          }
        })
        .finally(() => {
          if (active) {
            setLoading(false)
          }
        })
    }, 150)

    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [query, orgSlug])

  useEffect(() => {
    setSelectedIndex(0)
  }, [query, results])

  const { sections, flatRows } = useMemo(() => {
    const built: PaletteSection[] = []
    const flat: PaletteRow[] = []
    const visibleNavRows = NAV_ROWS.filter((row) => {
      const item = navItems.find((navItem) => navItem.href === row.href)

      return item?.permission === undefined || hasPermission(role, item.permission)
    })
    const pushSection = (heading: string, rows: ReadonlyArray<PaletteRow>): void => {
      if (rows.length === 0) {
        return
      }

      const indexed = rows.map((row) => {
        const flatIndex = flat.length
        flat.push(row)

        return { ...row, flatIndex }
      })
      built.push({ heading, rows: indexed })
    }

    const trimmed = query.trim()
    if (trimmed.length === 0) {
      const clientGroup = RESULT_GROUP_BY_TYPE.get("client")
      if (clientGroup !== undefined) {
        pushSection(
          "Připnuté",
          pins.map((pin) => toPinnedRow(pin, clientGroup)),
        )
      }

      const pinnedIds = new Set(pins.map((pin) => pin.id))
      pushSection(
        "Nedávné",
        recents
          .filter((item) => !(item.type === "client" && pinnedIds.has(item.id)))
          .flatMap((item) => {
            const group = RESULT_GROUP_BY_TYPE.get(item.type)

            return group !== undefined ? [toRecentRow(item, group)] : []
          }),
      )
      pushSection("Přejít na", visibleNavRows)
      pushSection("Vytvořit", CREATE_ROWS)
    } else {
      for (const group of RESULT_GROUPS) {
        const rows = results
          .filter((result) => result.type === group.type)
          .map((result) => toResultRow(result, group))
        pushSection(group.heading, rows)
      }

      const needle = normalize(trimmed)
      const commandRows = [...visibleNavRows, ...CREATE_ROWS].filter((row) =>
        normalize(row.label).includes(needle),
      )
      pushSection("Příkazy", commandRows)
    }

    return { sections: built, flatRows: flat }
  }, [query, results, pins, recents, role])

  const activeIndex = flatRows.length === 0 ? -1 : Math.min(selectedIndex, flatRows.length - 1)

  const pinnedIds = useMemo(() => new Set(pins.map((pin) => pin.id)), [pins])

  useEffect(() => {
    if (activeIndex < 0) {
      return
    }

    rowRefs.current[activeIndex]?.scrollIntoView({ block: "nearest" })
  }, [activeIndex])

  const handleOpenChange = useCallback((next: boolean): void => {
    setOpen(next)
    if (!next) {
      setQuery("")
      setResults([])
      setLoading(false)
      setSelectedIndex(0)
    }
  }, [])

  const activate = useCallback(
    (row: PaletteRow): void => {
      if (row.entity !== null) {
        void recordRecentItemAction(orgSlug, {
          itemType: row.entity.type,
          entityId: row.entity.id,
          title: row.label,
          href: row.href,
        })
      }

      handleOpenChange(false)
      router.push(orgHref(orgSlug, row.href))
    },
    [handleOpenChange, router, orgSlug],
  )

  const completeTicket = async (row: PaletteRow): Promise<void> => {
    if (row.entity === null || row.entity.type !== "ticket" || busyRowKey !== null) {
      return
    }

    const ticketId = row.entity.id
    setBusyRowKey(row.key)
    try {
      const result = await completeTicketCommandAction(orgSlug, ticketId)
      if (result.status === "success") {
        toastWithUndo(result)
        setResults((prev) =>
          prev.filter((item) => !(item.type === "ticket" && item.id === ticketId)),
        )
      } else if (result.status === "error") {
        toast({ variant: "error", title: result.message })
      }
    } finally {
      setBusyRowKey(null)
    }
  }

  const assignSelf = async (row: PaletteRow): Promise<void> => {
    if (row.entity === null || row.entity.type !== "ticket" || busyRowKey !== null) {
      return
    }

    const ticketId = row.entity.id
    setBusyRowKey(row.key)
    try {
      const result = await assignSelfToTicketCommandAction(orgSlug, ticketId)
      if (result.status === "success") {
        toastWithUndo(result)
      } else if (result.status === "error") {
        toast({ variant: "error", title: result.message })
      }
    } finally {
      setBusyRowKey(null)
    }
  }

  const togglePin = (row: PaletteRow): void => {
    if (row.entity === null || row.entity.type !== "client") {
      return
    }

    const entityId = row.entity.id
    const pin: PinnedClient = { id: entityId, title: row.label, href: row.href }
    const wasPinned = pins.some((entry) => entry.id === entityId)
    setPins((prev) =>
      wasPinned ? prev.filter((entry) => entry.id !== entityId) : [pin, ...prev],
    )
    void togglePinnedClientAction(orgSlug, { clientId: entityId, href: row.href })
      .then((result) => {
        if (result.status === "success" && result.pinned !== !wasPinned) {
          setPins((prev) =>
            result.pinned === true
              ? prev.some((entry) => entry.id === entityId)
                ? prev
                : [pin, ...prev]
              : prev.filter((entry) => entry.id !== entityId),
          )
        } else if (result.status === "error") {
          setPins((prev) =>
            wasPinned
              ? prev.some((entry) => entry.id === entityId)
                ? prev
                : [pin, ...prev]
              : prev.filter((entry) => entry.id !== entityId),
          )
          toast({ variant: "error", title: result.message })
        }
      })
      .catch(() => {
        setPins((prev) =>
          wasPinned
            ? prev.some((entry) => entry.id === entityId)
              ? prev
              : [pin, ...prev]
            : prev.filter((entry) => entry.id !== entityId),
        )
      })
  }

  const handleKeyDown = (event: React.KeyboardEvent): void => {
    if (event.key === "ArrowDown") {
      event.preventDefault()
      setSelectedIndex((prev) => Math.min(prev + 1, flatRows.length - 1))
    } else if (event.key === "ArrowUp") {
      event.preventDefault()
      setSelectedIndex((prev) => Math.max(prev - 1, 0))
    } else if (event.key === "Enter") {
      event.preventDefault()
      const row = flatRows[activeIndex]
      if (row === undefined) {
        return
      }

      if ((event.metaKey || event.ctrlKey) && row.entity?.type === "ticket") {
        void completeTicket(row)
      } else {
        activate(row)
      }
    }
  }

  const trimmedQuery = query.trim()
  const showEmpty = flatRows.length === 0 && !loading && trimmedQuery.length >= 2

  return (
    <DialogPrimitive.Root open={open} onOpenChange={handleOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay asChild>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
            className="fixed inset-0 z-[60] bg-scrim backdrop-blur-md"
          />
        </DialogPrimitive.Overlay>
        <DialogPrimitive.Content
          aria-label="Rychlé hledání"
          aria-describedby={undefined}
          onKeyDown={handleKeyDown}
          onOpenAutoFocus={(event) => {
            event.preventDefault()
            inputRef.current?.focus()
          }}
          className="fixed left-1/2 top-[12vh] z-[70] w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 focus:outline-none"
        >
          <DialogPrimitive.Title className="sr-only">Rychlé hledání</DialogPrimitive.Title>
          <motion.div
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden rounded-2xl border border-border bg-surface shadow-lifted"
          >
            <div className="flex items-center gap-3 border-b border-border px-4">
              <Search className="size-[18px] shrink-0 text-muted-soft" strokeWidth={2.25} />
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Hledat klienty, projekty, úkoly, dealy, e-maily"
                aria-label="Hledat"
                role="combobox"
                aria-expanded={true}
                aria-controls={listboxId}
                aria-autocomplete="list"
                aria-activedescendant={activeIndex >= 0 ? optionId(activeIndex) : undefined}
                autoComplete="off"
                spellCheck={false}
                className="min-w-0 flex-1 bg-transparent py-4 text-[15px] text-foreground placeholder:text-muted-soft focus:outline-none"
              />
              {loading ? (
                <Spinner className="size-4 text-muted-soft" />
              ) : (
                <Kbd className="hidden shrink-0 sm:inline-block">esc</Kbd>
              )}
            </div>

            <div
              id={listboxId}
              role="listbox"
              aria-label="Výsledky hledání"
              className="max-h-[min(58vh,420px)] overflow-y-auto p-2"
            >
              {showEmpty ? (
                <div className="px-3 py-10 text-center">
                  <p className="text-[14px] text-foreground">Nic nenalezeno</p>
                  <p className="mt-1 text-[13px] text-muted-soft">
                    Zkus jiné jméno klienta, projekt nebo úkol.
                  </p>
                </div>
              ) : (
                sections.map((section) => (
                  <div
                    key={section.heading}
                    role="group"
                    aria-labelledby={groupLabelId(section.heading)}
                    className="mb-1 last:mb-0"
                  >
                    <p
                      id={groupLabelId(section.heading)}
                      className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-soft"
                    >
                      {section.heading}
                    </p>
                    {section.rows.map((row) => {
                      const selected = row.flatIndex === activeIndex
                      const Icon = row.icon

                      return (
                        <div
                          key={row.key}
                          ref={(el) => {
                            rowRefs.current[row.flatIndex] = el
                          }}
                          id={optionId(row.flatIndex)}
                          role="option"
                          aria-selected={selected}
                          onMouseMove={() => setSelectedIndex(row.flatIndex)}
                          onClick={() => activate(row)}
                          className={cn(
                            "flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
                            selected ? "bg-surface-2" : "hover:bg-surface-2/60",
                          )}
                        >
                          <span
                            className={cn(
                              "flex size-7 shrink-0 items-center justify-center rounded-[7px]",
                              row.tile,
                            )}
                          >
                            <Icon className="size-4 text-white" strokeWidth={2.25} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[14px] font-medium text-foreground">
                              {row.label}
                            </span>
                            {row.sublabel !== null ? (
                              <span className="block truncate text-[12px] text-muted-soft">
                                {row.sublabel}
                              </span>
                            ) : null}
                            {row.excerpt !== null && row.excerpt.length > 0 ? (
                              <span className="mt-0.5 block truncate text-[12px] text-muted-soft/80">
                                {row.excerpt}
                              </span>
                            ) : null}
                          </span>
                          {selected && row.entity?.type === "ticket" ? (
                            <span className="flex shrink-0 items-center gap-1">
                              <button
                                type="button"
                                title="Dokončit (⌘⏎)"
                                aria-label="Dokončit"
                                disabled={busyRowKey !== null}
                                onClick={(event) => {
                                  event.stopPropagation()
                                  void completeTicket(row)
                                }}
                                className="flex size-6 cursor-pointer items-center justify-center rounded-md text-muted-soft transition-colors hover:bg-surface-3 hover:text-foreground disabled:opacity-50"
                              >
                                <Check className="size-3.5" strokeWidth={2.25} />
                              </button>
                              <button
                                type="button"
                                title="Přiřadit mně"
                                aria-label="Přiřadit mně"
                                disabled={busyRowKey !== null}
                                onClick={(event) => {
                                  event.stopPropagation()
                                  void assignSelf(row)
                                }}
                                className="flex size-6 cursor-pointer items-center justify-center rounded-md text-muted-soft transition-colors hover:bg-surface-3 hover:text-foreground disabled:opacity-50"
                              >
                                <UserPlus className="size-3.5" strokeWidth={2.25} />
                              </button>
                            </span>
                          ) : null}
                          {selected && row.entity?.type === "client" ? (
                            <button
                              type="button"
                              title={pinnedIds.has(row.entity.id) ? "Odepnout" : "Připnout"}
                              aria-label={pinnedIds.has(row.entity.id) ? "Odepnout" : "Připnout"}
                              aria-pressed={pinnedIds.has(row.entity.id)}
                              onClick={(event) => {
                                event.stopPropagation()
                                togglePin(row)
                              }}
                              className={cn(
                                "flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-md transition-colors",
                                pinnedIds.has(row.entity.id)
                                  ? "text-primary"
                                  : "text-muted-soft hover:bg-surface-3 hover:text-foreground",
                              )}
                            >
                              <Star
                                className={cn(
                                  "size-3.5",
                                  pinnedIds.has(row.entity.id) && "fill-current",
                                )}
                                strokeWidth={2.25}
                              />
                            </button>
                          ) : null}
                          {row.chipLabel !== null ? (
                            <span
                              className={cn(
                                "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium",
                                row.chipClass,
                              )}
                            >
                              {row.chipLabel}
                            </span>
                          ) : null}
                          {selected ? (
                            <CornerDownLeft className="size-3.5 shrink-0 text-muted-soft" />
                          ) : null}
                        </div>
                      )
                    })}
                  </div>
                ))
              )}
            </div>

            <div className="flex items-center gap-4 border-t border-border px-4 py-2.5 text-[11px] text-muted-soft">
              <span className="flex items-center gap-1.5">
                <Kbd className="px-1">↑↓</Kbd>
                pohyb
              </span>
              <span className="flex items-center gap-1.5">
                <Kbd className="px-1">⏎</Kbd>
                otevřít
              </span>
              <span className="ml-auto hidden items-center gap-1.5 sm:flex">
                <Kbd className="px-1">⌘K</Kbd>
                kdykoliv
              </span>
            </div>
          </motion.div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
