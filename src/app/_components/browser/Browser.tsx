"use client"

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import * as CheckboxPrimitive from "@radix-ui/react-checkbox"
import {
  Check,
  ChevronDown,
  ChevronRight,
  ChevronsUpDown,
  ChevronUp,
  Layers,
  ListFilter,
  Minus,
  Search,
  X,
} from "lucide-react"
import { Button } from "@/app/_ui/Button"
import { Checkbox } from "@/app/_ui/Checkbox"
import { DatePicker } from "@/app/_ui/DatePicker"
import { EmptyState } from "@/app/_ui/EmptyState"
import { Input, InputVariant } from "@/app/_ui/Input"
import { Kbd } from "@/app/_ui/Kbd"
import { Pagination } from "@/app/_ui/Pagination"
import { Popover, PopoverContent, PopoverTrigger } from "@/app/_ui/Popover"
import { Table, TBody, TD, TH, THead, TR } from "@/app/_ui/Table"
import { cn } from "@/lib/cn"
import { formatCzechDate } from "@/lib/dates"
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS } from "@/lib/pageSize"
import { SortDirection } from "@/core/types/query.types"
import { SavedViewsMenu } from "./SavedViewsMenu"
import { normalizeBrowserQuery } from "./savedViews"
import type {
  BrowserBucket,
  BrowserColumn,
  BrowserColumnFilter,
  BrowserEmpty,
  BrowserFilterOption,
  BrowserGroupConfig,
  BrowserPreset,
  BrowserSelection,
  BrowserSort,
  BrowserViewTabs,
} from "./types"

const SEARCH_DEBOUNCE_MS = 250
const GROUP_ROW_CAP = 50
const headPadding = "px-3 py-2.5"
const cellPadding = "px-3 py-2.5"
const stickyFirstCol = "sticky left-0 z-[1]"
const stickyScrolledShadow = "shadow-[6px_0_8px_-6px_rgba(0,0,0,0.15)]"
// Vertical scroll container: dvh-capped so header cells can stick, with a floor
// so short viewports never squeeze the table into a tiny scroll box.
const tableScrollArea = "max-h-[max(24rem,calc(100dvh-240px))] overflow-auto"
const stickyHead = "sticky top-0 z-[2] border-b border-hairline bg-surface"
const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
// Table rows cannot rely on box-shadow rings (inconsistent on tr), so keyboard
// focusable rows draw an inset outline instead.
const rowFocus = "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"

interface BrowserProps<R> {
  rows: R[]
  total: number
  page: number
  pageSize: number
  rowKey: (row: R) => string
  columns: BrowserColumn<R>[]
  sort?: BrowserSort
  searchValue: string
  searchPlaceholder: string
  searchAriaLabel: string
  presets?: BrowserPreset[]
  viewTabs?: BrowserViewTabs
  group?: BrowserGroupConfig<R>
  rowHref?: (row: R) => string
  onRowClick?: (row: R) => void
  selection?: BrowserSelection
  empty: BrowserEmpty
  emptyFiltered: BrowserEmpty
  emptyIcon?: ReactNode
}

const filterParamKeys = (filter: BrowserColumnFilter): string[] =>
  filter.kind === "dateRange" ? [filter.startKey, filter.endKey] : [filter.paramKey]

const isFilterActive = (filter: BrowserColumnFilter): boolean => {
  if (filter.kind === "checkbox") {
    return filter.selected.length > 0
  }

  if (filter.kind === "single") {
    return filter.value !== undefined
  }

  return filter.start !== undefined || filter.end !== undefined
}

const filterActiveCount = (filter: BrowserColumnFilter): number => {
  if (filter.kind === "checkbox") {
    return filter.selected.length
  }

  if (filter.kind === "single") {
    return filter.value !== undefined ? 1 : 0
  }

  return filter.start !== undefined || filter.end !== undefined ? 1 : 0
}

const collapseStorageKey = (pathname: string, groupField: string): string =>
  `browser:collapsed:${pathname}:${groupField}`

// App list routes live under /[orgSlug]/<page...>, so the pathname carries both
// pieces the saved-views storage key needs. Anything shallower (login, no-access)
// has no workspace and gets no saved views.
const savedViewsScopeFromPathname = (
  pathname: string,
): { orgSlug: string; pageKey: string } | null => {
  const segments = pathname.split("/").filter((segment) => segment.length > 0)
  const orgSlug = segments[0]
  if (orgSlug === undefined || segments.length < 2) {
    return null
  }

  return { orgSlug, pageKey: segments.slice(1).join("/") }
}

const readCollapsedGroups = (key: string): ReadonlySet<string> => {
  try {
    const raw = window.sessionStorage.getItem(key)
    if (raw === null) {
      return new Set()
    }

    const parsed: unknown = JSON.parse(raw)

    return new Set(
      Array.isArray(parsed)
        ? parsed.filter((entry): entry is string => typeof entry === "string")
        : [],
    )
  } catch {
    // Unreadable or corrupted storage entry: fall back to everything expanded.
    return new Set()
  }
}

const writeCollapsedGroups = (key: string, groups: ReadonlySet<string>): void => {
  try {
    window.sessionStorage.setItem(key, JSON.stringify([...groups]))
  } catch {
    // Storage can be unavailable (private mode, quota); collapse state then
    // lives only in memory for the current render.
  }
}

const showMoreLabel = (count: number): string =>
  count === 1 ? "Zobrazit další 1" : count <= 4 ? `Zobrazit další ${count}` : `Zobrazit dalších ${count}`

// A level-1 bucket paired with its level-2 children (null when only one level is
// active). The Browser builds this by calling the page bucketizer once per level.
interface NestedBucket<R> extends BrowserBucket<R> {
  children: BrowserBucket<R>[] | null
}

// Collapse the config `current` (single string from a legacy wrapper, or an
// ordered list from a nested surface) into a deduped, bounded level array.
const normalizeGroupLevels = (
  current: string | string[] | undefined,
  maxLevels: number,
): string[] => {
  if (current === undefined) {
    return []
  }

  const list = Array.isArray(current) ? current : [current]
  const levels: string[] = []
  for (const level of list) {
    if (level.length > 0 && !levels.includes(level)) {
      levels.push(level)
      if (levels.length >= maxLevels) {
        break
      }
    }
  }

  return levels
}

export function Browser<R>({
  rows,
  total,
  page,
  pageSize,
  rowKey,
  columns,
  sort,
  searchValue,
  searchPlaceholder,
  searchAriaLabel,
  presets,
  viewTabs,
  group,
  rowHref,
  onRowClick,
  selection,
  empty,
  emptyFiltered,
}: BrowserProps<R>) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const searchRef = useRef<HTMLInputElement>(null)
  const [scrolledX, setScrolledX] = useState(false)
  const [collapsedGroups, setCollapsedGroups] = useState<ReadonlySet<string>>(new Set())
  const [groupRowLimits, setGroupRowLimits] = useState<Readonly<Record<string, number>>>({})

  const groupLevels = useMemo(
    () => (group !== undefined ? normalizeGroupLevels(group.current, group.maxLevels ?? 1) : []),
    [group],
  )

  // Collapse state survives sort/filter/page tweaks: it is keyed by page and the
  // active group levels in sessionStorage and restored on mount (client only).
  const storageKey =
    groupLevels.length > 0 ? collapseStorageKey(pathname, groupLevels.join(",")) : null

  useEffect(() => {
    setCollapsedGroups(storageKey !== null ? readCollapsedGroups(storageKey) : new Set())
    setGroupRowLimits({})
  }, [storageKey])

  const push = useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      const params = new URLSearchParams(searchParams.toString())
      mutate(params)
      const queryString = params.toString()
      startTransition(() => {
        router.push(queryString.length > 0 ? `${pathname}?${queryString}` : pathname)
      })
    },
    [router, pathname, searchParams],
  )

  const savedViewsScope = useMemo(() => savedViewsScopeFromPathname(pathname), [pathname])
  const normalizedQuery = useMemo(() => normalizeBrowserQuery(searchParams.toString()), [searchParams])

  // A saved view replaces the whole browser state; only the page size is kept,
  // because it is a browsing preference stripped from the stored query.
  const applySavedView = useCallback(
    (query: string) => {
      const params = new URLSearchParams(query)
      const pageSize = searchParams.get("pageSize")
      if (pageSize !== null) {
        params.set("pageSize", pageSize)
      }

      const queryString = params.toString()
      startTransition(() => {
        router.push(queryString.length > 0 ? `${pathname}?${queryString}` : pathname)
      })
    },
    [router, pathname, searchParams],
  )

  const setParam = useCallback(
    (key: string, value: string | null) => {
      push((params) => {
        if (value === null || value.length === 0) {
          params.delete(key)
        } else {
          params.set(key, value)
        }

        params.delete("page")
      })
    },
    [push],
  )

  const toggleMultiParam = (key: string, value: string, selected: ReadonlyArray<string>) => {
    const next = selected.includes(value)
      ? selected.filter((entry) => entry !== value)
      : [...selected, value]
    setParam(key, next.length > 0 ? next.join(",") : null)
  }

  const setDateRange = (startKey: string, endKey: string, start: string | null, end: string | null) => {
    push((params) => {
      if (start !== null && start.length > 0) {
        params.set(startKey, start)
      } else {
        params.delete(startKey)
      }

      if (end !== null && end.length > 0) {
        params.set(endKey, end)
      } else {
        params.delete(endKey)
      }

      params.delete("page")
    })
  }

  const setSort = (field: string) => {
    const current = sort !== undefined && sort.field === field ? sort.direction : null
    const nextDir =
      current === null
        ? SortDirection.Asc
        : current === SortDirection.Asc
          ? SortDirection.Desc
          : null
    push((params) => {
      if (nextDir === null) {
        params.delete("sortField")
        params.delete("sortDir")
      } else {
        params.set("sortField", field)
        params.set("sortDir", nextDir)
      }

      params.delete("page")
    })
  }

  const setPage = (next: number) => {
    push((params) => {
      if (next <= 1) {
        params.delete("page")
      } else {
        params.set("page", String(next))
      }
    })
  }

  const setPageSize = (next: number) => {
    push((params) => {
      if (next === DEFAULT_PAGE_SIZE) {
        params.delete("pageSize")
      } else {
        params.set("pageSize", String(next))
      }

      params.delete("page")
    })
  }

  const filters = useMemo(
    () => columns.map((column) => column.filter).filter((filter): filter is BrowserColumnFilter => filter !== undefined),
    [columns],
  )

  const clearFilters = () => {
    push((params) => {
      for (const filter of filters) {
        for (const key of filterParamKeys(filter)) {
          params.delete(key)
        }
      }

      params.delete("q")
      params.delete("page")
    })
  }

  const [localSearch, setLocalSearch] = useState(searchValue)

  useEffect(() => {
    setLocalSearch((prev) => (prev.trim() === searchValue ? prev : searchValue))
  }, [searchValue])

  useEffect(() => {
    const normalized = localSearch.trim()
    if (normalized === searchValue) {
      return
    }

    const handle = setTimeout(() => {
      push((params) => {
        if (normalized.length > 0) {
          params.set("q", normalized)
        } else {
          params.delete("q")
        }

        params.delete("page")
      })
    }, SEARCH_DEBOUNCE_MS)

    return () => clearTimeout(handle)
  }, [localSearch, searchValue, push])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) {
        return
      }

      const target = event.target as HTMLElement | null
      if (
        target !== null &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)
      ) {
        return
      }

      event.preventDefault()
      searchRef.current?.focus()
    }

    window.addEventListener("keydown", onKeyDown)

    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  const searchActive = searchValue.length > 0
  const activeFilterCount = filters.reduce((sum, filter) => sum + filterActiveCount(filter), 0)
  const anyFilterActive = activeFilterCount > 0 || searchActive

  const applyFilter = (filter: BrowserColumnFilter, value: string) => {
    if (filter.kind === "checkbox") {
      toggleMultiParam(filter.paramKey, value, filter.selected)
    }
  }

  const presetResetKeys = useMemo(() => {
    const keys = new Set<string>()
    for (const preset of presets ?? []) {
      for (const key of Object.keys(preset.params)) {
        keys.add(key)
      }
    }

    return [...keys]
  }, [presets])

  const isPresetActive = (preset: BrowserPreset): boolean =>
    Object.entries(preset.params).every(([key, value]) => searchParams.get(key) === value)

  const applyPreset = (preset: BrowserPreset) => {
    const active = isPresetActive(preset)
    push((params) => {
      for (const key of presetResetKeys) {
        params.delete(key)
      }

      if (!active) {
        for (const [key, value] of Object.entries(preset.params)) {
          params.set(key, value)
        }
      }

      params.delete("page")
    })
  }

  const setView = (value: string) => {
    if (viewTabs === undefined) {
      return
    }

    setParam(viewTabs.paramKey, value === viewTabs.defaultValue ? null : value)
  }

  const chips = buildChips(filters, toggleMultiParam, setParam, setDateRange)

  const setGroupLevels = (levels: string[]) => {
    if (levels.length > 0) {
      setParam("group", levels.join(","))
    } else {
      setParam("group", group?.clearsToNone === true ? "none" : null)
    }
  }

  const buckets = useMemo<NestedBucket<R>[] | null>(() => {
    const [first, second] = groupLevels
    if (group === undefined || first === undefined) {
      return null
    }

    const top = group.build(rows, first)
    if (second === undefined) {
      return top.map((bucket) => ({ ...bucket, children: null }))
    }

    return top.map((bucket) => ({ ...bucket, children: group.build(bucket.rows, second) }))
  }, [group, groupLevels, rows])

  const toggleGroupCollapse = (key: string) => {
    const next = new Set(collapsedGroups)
    if (next.has(key)) {
      next.delete(key)
    } else {
      next.add(key)
    }

    setCollapsedGroups(next)
    if (storageKey !== null) {
      writeCollapsedGroups(storageKey, next)
    }
  }

  const selectable = selection !== undefined
  const columnCount = columns.length + (selectable ? 1 : 0)
  const visibleKeys = useMemo(() => rows.map((row) => rowKey(row)), [rows, rowKey])
  const allVisibleSelected =
    selection !== undefined &&
    visibleKeys.length > 0 &&
    visibleKeys.every((key) => selection.selected.has(key))
  const someVisibleSelected =
    selection !== undefined && visibleKeys.some((key) => selection.selected.has(key))

  const toggleAllVisible = () => {
    if (selection === undefined) {
      return
    }

    selection.onChange(allVisibleSelected ? new Set() : new Set(visibleKeys))
  }

  const toggleRowSelected = (key: string) => {
    if (selection === undefined) {
      return
    }

    const next = new Set(selection.selected)
    if (next.has(key)) {
      next.delete(key)
    } else {
      next.add(key)
    }

    selection.onChange(next)
  }

  const clickable = rowHref !== undefined || onRowClick !== undefined
  // Rows with a href carry a real link in the primary cell; the row-level click
  // stays as a convenience and must yield to modified clicks and inner controls.
  const handleRowClick = (row: R, event: ReactMouseEvent<HTMLTableRowElement>) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return
    }

    if (event.target instanceof Element && event.target.closest("a, button") !== null) {
      return
    }

    if (rowHref !== undefined) {
      router.push(rowHref(row))
    } else {
      onRowClick?.(row)
    }
  }

  const handleRowKeyDown = (row: R, event: ReactKeyboardEvent<HTMLTableRowElement>) => {
    if (event.key !== "Enter" && event.key !== " ") {
      return
    }

    if (event.target !== event.currentTarget) {
      return
    }

    event.preventDefault()
    onRowClick?.(row)
  }

  const keyboardRow = rowHref === undefined && onRowClick !== undefined

  // `keyPrefix` namespaces the React key per bucket: a bucketizer may place one row
  // into several buckets (a multi-assignee ticket under each assignee), and the flat
  // TBody would otherwise get duplicate keys. Selection stays keyed by the plain row
  // key, so selecting a duplicated row selects all its occurrences consistently.
  const renderRow = (row: R, index: number, keyPrefix?: string) => {
    const href = rowHref?.(row)
    const key = rowKey(row)

    return (
      <TR
        key={keyPrefix !== undefined ? `${keyPrefix}:${key}` : key}
        onClick={clickable ? (event) => handleRowClick(row, event) : undefined}
        onKeyDown={keyboardRow ? (event) => handleRowKeyDown(row, event) : undefined}
        tabIndex={keyboardRow ? 0 : undefined}
        className={cn("group", clickable && "cursor-pointer", keyboardRow && rowFocus)}
      >
        {selectable ? (
          <TD
            onClick={(event) => event.stopPropagation()}
            className={cn(
              cellPadding,
              "w-10 pl-5",
              stickyFirstCol,
              "bg-surface transition-colors group-hover:bg-surface-2",
              scrolledX && stickyScrolledShadow,
            )}
          >
            <SelectionCheckbox
              checked={selection !== undefined && selection.selected.has(key)}
              onCheckedChange={() => toggleRowSelected(key)}
              ariaLabel="Vybrat řádek"
            />
          </TD>
        ) : null}
        {columns.map((column, columnIndex) => (
          <TD
            key={column.id}
            className={cn(
              cellPadding,
              columnIndex === 0 &&
                !selectable &&
                cn(
                  "pl-5",
                  stickyFirstCol,
                  "bg-surface transition-colors group-hover:bg-surface-2",
                  scrolledX && stickyScrolledShadow,
                ),
              columnIndex === columns.length - 1 && "pr-5",
              column.align === "right" && "text-right",
              column.cellClassName,
            )}
          >
            {columnIndex === 0 && href !== undefined ? (
              <Link href={href} className="block">
                {column.cell(row, index)}
              </Link>
            ) : (
              column.cell(row, index)
            )}
          </TD>
        ))}
      </TR>
    )
  }

  const renderGroupHeader = (
    bucket: BrowserBucket<R>,
    collapseKey: string,
    depth: number,
    collapsed: boolean,
  ) => (
    <TR
      key={`group-${collapseKey}`}
      className={
        depth === 0 ? "bg-surface-2/60 hover:bg-surface-2" : "bg-surface-2/25 hover:bg-surface-2/60"
      }
    >
      <TD colSpan={columnCount} className={cn("px-3 py-1.5", depth === 0 ? "pl-4" : "pl-10")}>
        <button
          type="button"
          onClick={() => toggleGroupCollapse(collapseKey)}
          aria-expanded={!collapsed}
          className={cn(
            "flex w-full cursor-pointer items-center gap-2 rounded-md text-left",
            focusRing,
          )}
        >
          {collapsed ? (
            <ChevronRight className="size-4 text-muted-soft" />
          ) : (
            <ChevronDown className="size-4 text-muted-soft" />
          )}
          {bucket.dotClassName !== undefined ? (
            <span
              aria-hidden
              className={cn("size-[7px] shrink-0 rounded-full", bucket.dotClassName)}
            />
          ) : null}
          <span
            className={cn(
              "text-[13px] text-foreground",
              depth === 0 ? "font-semibold" : "font-medium",
            )}
          >
            {bucket.label}
          </span>
          <span className="rounded-full bg-surface-3/70 px-2 py-0.5 text-[11px] font-medium tabular-nums text-muted">
            {bucket.rows.length}
          </span>
        </button>
      </TD>
    </TR>
  )

  const renderLeafRows = (bucket: BrowserBucket<R>, collapseKey: string): ReactNode[] => {
    const limit = groupRowLimits[collapseKey] ?? GROUP_ROW_CAP
    const visibleRows = bucket.rows.slice(0, limit)
    const hiddenCount = bucket.rows.length - visibleRows.length

    return [
      ...visibleRows.map((row, index) => renderRow(row, index, collapseKey)),
      ...(hiddenCount > 0
        ? [
            <TR key={`group-more-${collapseKey}`} className="hover:bg-transparent">
              <TD colSpan={columnCount} className="px-3 py-1.5 pl-5">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setGroupRowLimits((prev) => ({
                      ...prev,
                      [collapseKey]: limit + GROUP_ROW_CAP,
                    }))
                  }
                >
                  {showMoreLabel(Math.min(GROUP_ROW_CAP, hiddenCount))}
                </Button>
              </TD>
            </TR>,
          ]
        : []),
    ]
  }

  const renderBuckets = (nested: NestedBucket<R>[]): ReactNode[] =>
    nested.flatMap((bucket) => {
      const collapsed = collapsedGroups.has(bucket.key)
      const header = renderGroupHeader(bucket, bucket.key, 0, collapsed)
      if (collapsed) {
        return [header]
      }

      if (bucket.children === null) {
        return [header, ...renderLeafRows(bucket, bucket.key)]
      }

      return [
        header,
        ...bucket.children.flatMap((child) => {
          const childKey = `${bucket.key}/${child.key}`
          const childCollapsed = collapsedGroups.has(childKey)
          const childHeader = renderGroupHeader(child, childKey, 1, childCollapsed)

          return childCollapsed ? [childHeader] : [childHeader, ...renderLeafRows(child, childKey)]
        }),
      ]
    })

  return (
    <div className="flex flex-col gap-4">
      {viewTabs !== undefined ? <ViewTabsBar viewTabs={viewTabs} onSelect={setView} /> : null}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-80">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-soft" />
          <Input
            ref={searchRef}
            variant={InputVariant.Search}
            value={localSearch}
            onChange={(event) => setLocalSearch(event.target.value)}
            placeholder={searchPlaceholder}
            aria-label={searchAriaLabel}
          />
          {localSearch.length > 0 ? (
            <button
              type="button"
              onClick={() => setLocalSearch("")}
              aria-label="Vymazat hledání"
              className={cn(
                "absolute right-2.5 top-1/2 flex size-6 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-muted-soft transition-colors hover:text-foreground",
                focusRing,
              )}
            >
              <X className="size-4" />
            </button>
          ) : (
            <Kbd className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2">/</Kbd>
          )}
        </div>
        {savedViewsScope !== null || group !== undefined ? (
          <div className="ml-auto flex items-center gap-2">
            {savedViewsScope !== null ? (
              <SavedViewsMenu
                orgSlug={savedViewsScope.orgSlug}
                pageKey={savedViewsScope.pageKey}
                currentQuery={normalizedQuery}
                onApply={applySavedView}
              />
            ) : null}
            {group !== undefined ? (
              <GroupMenu
                options={group.options}
                levels={groupLevels}
                maxLevels={group.maxLevels ?? 1}
                onChange={setGroupLevels}
              />
            ) : null}
          </div>
        ) : null}
      </div>

      {presets !== undefined && presets.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          {presets.map((preset) => {
            const active = isPresetActive(preset)
            const Icon = preset.icon

            return (
              <button
                key={preset.key}
                type="button"
                onClick={() => applyPreset(preset)}
                aria-pressed={active}
                className={cn(
                  "inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors duration-150",
                  focusRing,
                  active
                    ? "border-primary/30 bg-primary-soft text-primary"
                    : "border-border bg-surface text-muted hover:border-border-strong hover:text-foreground",
                )}
              >
                {Icon !== undefined ? <Icon className="size-3.5" /> : null}
                {preset.label}
              </button>
            )
          })}
        </div>
      ) : null}

      {chips.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {chips.map((chip) => (
            <span
              key={chip.key}
              className="inline-flex h-7 items-center gap-1 rounded-full bg-primary-soft pl-3 pr-0.5 text-xs font-medium text-primary"
            >
              {chip.label}
              <button
                type="button"
                onClick={chip.onRemove}
                aria-label={`Odebrat filtr ${chip.label}`}
                className={cn(
                  "flex size-6 cursor-pointer items-center justify-center rounded-full transition-colors hover:bg-primary/15",
                  focusRing,
                )}
              >
                <X className="size-3.5" />
              </button>
            </span>
          ))}
          <Button variant="ghost" size="sm" onClick={clearFilters} className="h-7 px-2 text-xs">
            Vymazat vše
          </Button>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-hairline bg-surface shadow-soft">
        {rows.length === 0 ? (
          anyFilterActive ? (
            <EmptyState
              icon={emptyFiltered.icon}
              title={emptyFiltered.title}
              description={emptyFiltered.description}
              action={
                <Button variant="outline" size="sm" onClick={clearFilters}>
                  Vymazat filtry
                </Button>
              }
            />
          ) : (
            <EmptyState icon={empty.icon} title={empty.title} description={empty.description} />
          )
        ) : (
          <>
            <div
              className={tableScrollArea}
              onScroll={(event) => setScrolledX(event.currentTarget.scrollLeft > 0)}
            >
              <Table
                aria-busy={isPending}
                className={cn(
                  // Separate borders so per-cell borders travel with sticky header
                  // cells (collapsed borders detach from sticky positioning).
                  "border-separate border-spacing-0",
                  isPending && "opacity-60 transition-opacity",
                )}
              >
                <THead>
                  <TR className="hover:bg-transparent">
                    {selectable ? (
                      <TH
                        className={cn(
                          headPadding,
                          stickyHead,
                          "w-10 pl-5 left-0 z-[3]",
                          scrolledX && stickyScrolledShadow,
                        )}
                      >
                        <SelectionCheckbox
                          checked={
                            allVisibleSelected
                              ? true
                              : someVisibleSelected
                                ? "indeterminate"
                                : false
                          }
                          onCheckedChange={toggleAllVisible}
                          ariaLabel={allVisibleSelected ? "Zrušit výběr všech" : "Vybrat vše"}
                        />
                      </TH>
                    ) : null}
                    {columns.map((column, columnIndex) => {
                      const sortedDir =
                        column.sortField !== undefined && sort?.field === column.sortField
                          ? sort.direction
                          : null

                      return (
                        <TH
                          key={column.id}
                          aria-sort={
                            sortedDir === SortDirection.Asc
                              ? "ascending"
                              : sortedDir === SortDirection.Desc
                                ? "descending"
                                : undefined
                          }
                          className={cn(
                            headPadding,
                            stickyHead,
                            columnIndex === 0 &&
                              !selectable &&
                              cn(
                                "pl-5 left-0 z-[3]",
                                scrolledX && stickyScrolledShadow,
                              ),
                            columnIndex === columns.length - 1 && "pr-5",
                            column.align === "right" && "text-right",
                            column.headClassName,
                          )}
                        >
                          <HeaderCell column={column} sort={sort} onSort={setSort} onFilter={applyFilter} onSingle={setParam} onDateRange={setDateRange} />
                        </TH>
                      )
                    })}
                  </TR>
                </THead>
                <TBody className="[&>tr:first-child>td]:border-t-0">
                  {buckets !== null
                    ? renderBuckets(buckets)
                    : rows.map((row, index) => renderRow(row, index))}
                </TBody>
              </Table>
            </div>

            <div className="flex items-center justify-between gap-4 border-t border-hairline px-5 py-2.5">
              <span className="text-[13px] tabular-nums text-muted">
                {buckets !== null
                  ? `Celkem ${total} ve ${buckets.length} skupinách`
                  : `${(page - 1) * pageSize + 1}-${Math.min(page * pageSize, total)} z ${total}`}
              </span>
              {buckets === null ? (
                <Pagination
                  page={page}
                  pageSize={pageSize}
                  total={total}
                  onPageChange={setPage}
                  onPageSizeChange={
                    PAGE_SIZE_OPTIONS.some((option) => option === pageSize) ? setPageSize : undefined
                  }
                />
              ) : null}
            </div>
          </>
        )}
      </div>

      {selection !== undefined && selection.selected.size > 0 ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-40 flex justify-center px-4">
          <div className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-hairline bg-surface px-4 py-2.5 shadow-soft">
            <span className="whitespace-nowrap text-[13px] font-medium tabular-nums text-foreground">
              {selection.selected.size} vybráno
            </span>
            <span aria-hidden className="h-5 w-px bg-border" />
            <div className="flex items-center gap-1.5">{selection.actions}</div>
            <span aria-hidden className="h-5 w-px bg-border" />
            <button
              type="button"
              onClick={() => selection.onChange(new Set())}
              aria-label="Zrušit výběr"
              className={cn(
                "flex size-7 cursor-pointer items-center justify-center rounded-full text-muted-soft transition-colors hover:bg-surface-3/60 hover:text-foreground",
                focusRing,
              )}
            >
              <X className="size-4" />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

interface SelectionCheckboxProps {
  checked: boolean | "indeterminate"
  onCheckedChange: () => void
  ariaLabel: string
}

function SelectionCheckbox({ checked, onCheckedChange, ariaLabel }: SelectionCheckboxProps) {
  return (
    <CheckboxPrimitive.Root
      checked={checked}
      onCheckedChange={onCheckedChange}
      onClick={(event) => event.stopPropagation()}
      aria-label={ariaLabel}
      className="flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-md border border-border-strong bg-surface transition-[color,border-color,background-color] duration-150 hover:border-primary/50 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/20 data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=indeterminate]:border-primary data-[state=indeterminate]:bg-primary"
    >
      <CheckboxPrimitive.Indicator className="flex items-center justify-center">
        {checked === "indeterminate" ? (
          <Minus className="h-3.5 w-3.5 text-primary-foreground" />
        ) : (
          <Check className="h-3.5 w-3.5 text-primary-foreground" />
        )}
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

interface Chip {
  key: string
  label: string
  onRemove: () => void
}

function buildChips(
  filters: BrowserColumnFilter[],
  onToggle: (key: string, value: string, selected: ReadonlyArray<string>) => void,
  onSingle: (key: string, value: string | null) => void,
  onDateRange: (startKey: string, endKey: string, start: string | null, end: string | null) => void,
): Chip[] {
  const chips: Chip[] = []
  for (const filter of filters) {
    if (filter.kind === "checkbox") {
      for (const value of filter.selected) {
        const option = filter.options.find((candidate) => candidate.value === value)
        chips.push({
          key: `${filter.paramKey}-${value}`,
          label: `${filter.label}: ${option?.label ?? value}`,
          onRemove: () => onToggle(filter.paramKey, value, filter.selected),
        })
      }
    } else if (filter.kind === "single") {
      if (filter.value !== undefined) {
        const option = filter.options.find((candidate) => candidate.value === filter.value)
        chips.push({
          key: filter.paramKey,
          label: `${filter.label}: ${option?.label ?? filter.value}`,
          onRemove: () => onSingle(filter.paramKey, null),
        })
      }
    } else if (filter.start !== undefined || filter.end !== undefined) {
      const format = filter.formatValue ?? ((iso: string) => formatCzechDate(iso))
      chips.push({
        key: filter.startKey,
        label: `${filter.label}: ${filter.start !== undefined ? format(filter.start) : "…"} - ${filter.end !== undefined ? format(filter.end) : "…"}`,
        onRemove: () => onDateRange(filter.startKey, filter.endKey, null, null),
      })
    }
  }

  return chips
}

interface HeaderCellProps<R> {
  column: BrowserColumn<R>
  sort: BrowserSort | undefined
  onSort: (field: string) => void
  onFilter: (filter: BrowserColumnFilter, value: string) => void
  onSingle: (key: string, value: string | null) => void
  onDateRange: (startKey: string, endKey: string, start: string | null, end: string | null) => void
}

function HeaderCell<R>({ column, sort, onSort, onFilter, onSingle, onDateRange }: HeaderCellProps<R>) {
  const label =
    column.sortField !== undefined ? (
      <SortButton field={column.sortField} label={column.header} sort={sort} onSort={onSort} />
    ) : (
      <span>{column.header}</span>
    )
  if (column.filter === undefined) {
    return label
  }

  return (
    <div className={cn("flex items-center gap-1", column.align === "right" && "justify-end")}>
      {label}
      <ColumnFilterControl filter={column.filter} onToggle={onFilter} onSingle={onSingle} onDateRange={onDateRange} />
    </div>
  )
}

interface SortButtonProps {
  field: string
  label: string
  sort: BrowserSort | undefined
  onSort: (field: string) => void
}

function SortButton({ field, label, sort, onSort }: SortButtonProps) {
  const active = sort !== undefined && sort.field === field
  const direction = active ? sort.direction : null
  const Icon =
    direction === SortDirection.Asc
      ? ChevronUp
      : direction === SortDirection.Desc
        ? ChevronDown
        : ChevronsUpDown
  // The accessible name announces what the NEXT click does in the tri-state
  // cycle: none -> ascending -> descending -> none.
  const nextActionLabel =
    direction === null
      ? `Seřadit podle ${label} vzestupně`
      : direction === SortDirection.Asc
        ? `Seřadit podle ${label} sestupně`
        : `Zrušit řazení podle ${label}`

  return (
    <button
      type="button"
      onClick={() => onSort(field)}
      aria-label={nextActionLabel}
      className={cn(
        "inline-flex cursor-pointer items-center gap-1 whitespace-nowrap rounded-md text-xs font-medium transition-colors",
        focusRing,
        active ? "text-foreground" : "text-muted-soft hover:text-foreground",
      )}
    >
      {label}
      <Icon className={cn("size-3.5", active ? "text-primary" : "text-muted-soft/70")} />
    </button>
  )
}

interface ColumnFilterControlProps {
  filter: BrowserColumnFilter
  onToggle: (filter: BrowserColumnFilter, value: string) => void
  onSingle: (key: string, value: string | null) => void
  onDateRange: (startKey: string, endKey: string, start: string | null, end: string | null) => void
}

function ColumnFilterControl({ filter, onToggle, onSingle, onDateRange }: ColumnFilterControlProps) {
  const [open, setOpen] = useState(false)
  const active = isFilterActive(filter)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={filter.label}
          className={cn(
            "inline-flex size-6 cursor-pointer items-center justify-center rounded-full transition-colors",
            focusRing,
            active
              ? "bg-primary-soft text-primary"
              : "text-muted-soft/70 hover:bg-surface-3/60 hover:text-foreground",
          )}
        >
          <ListFilter className="size-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        {filter.kind === "checkbox" ? (
          <CheckboxList
            options={filter.options}
            selected={filter.selected}
            onToggle={(value) => onToggle(filter, value)}
          />
        ) : filter.kind === "single" ? (
          <SingleOptionList
            options={filter.options}
            value={filter.value}
            allLabel={filter.allLabel}
            onSelect={(value) => {
              onSingle(filter.paramKey, value)
              setOpen(false)
            }}
          />
        ) : (
          <DateRangeFilter
            start={filter.start}
            end={filter.end}
            onApply={(start, end) => onDateRange(filter.startKey, filter.endKey, start, end)}
          />
        )}
      </PopoverContent>
    </Popover>
  )
}

interface CheckboxListProps {
  options: BrowserFilterOption[]
  selected: ReadonlyArray<string>
  onToggle: (value: string) => void
}

function CheckboxList({ options, selected, onToggle }: CheckboxListProps) {
  return (
    <div className="flex max-h-72 min-w-52 flex-col gap-0.5 overflow-y-auto p-1.5">
      {options.map((option) => (
        <label
          key={option.value}
          className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm text-foreground transition-colors hover:bg-surface-2"
        >
          <Checkbox
            checked={selected.includes(option.value)}
            onCheckedChange={() => onToggle(option.value)}
            className="h-4 w-4"
          />
          {option.dotClassName !== undefined ? (
            <span aria-hidden className={cn("size-[7px] shrink-0 rounded-full", option.dotClassName)} />
          ) : null}
          <span className="truncate">{option.label}</span>
        </label>
      ))}
    </div>
  )
}

interface SingleOptionListProps {
  options: BrowserFilterOption[]
  value: string | undefined
  allLabel: string
  onSelect: (value: string | null) => void
}

function SingleOptionList({ options, value, allLabel, onSelect }: SingleOptionListProps) {
  return (
    <div className="flex max-h-72 min-w-48 flex-col gap-0.5 overflow-y-auto p-1">
      <OptionButton active={value === undefined} label={allLabel} onClick={() => onSelect(null)} />
      {options.map((option) => (
        <OptionButton
          key={option.value}
          active={value === option.value}
          label={option.label}
          dotClassName={option.dotClassName}
          onClick={() => onSelect(option.value)}
        />
      ))}
    </div>
  )
}

interface OptionButtonProps {
  active: boolean
  label: string
  dotClassName?: string
  onClick: () => void
}

function OptionButton({ active, label, dotClassName, onClick }: OptionButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex cursor-pointer items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors",
        focusRing,
        active ? "bg-primary-soft text-primary" : "text-foreground hover:bg-surface-2",
      )}
    >
      <span className="flex items-center gap-2 truncate">
        {dotClassName !== undefined ? (
          <span aria-hidden className={cn("size-[7px] shrink-0 rounded-full", dotClassName)} />
        ) : null}
        <span className="truncate">{label}</span>
      </span>
      {active ? <Check className="size-4 shrink-0" /> : null}
    </button>
  )
}

interface GroupMenuProps {
  options: BrowserFilterOption[]
  levels: string[]
  maxLevels: number
  onChange: (levels: string[]) => void
}

function GroupMenu({ options, levels, maxLevels, onChange }: GroupMenuProps) {
  const [open, setOpen] = useState(false)
  const [primary, secondary] = levels
  const nested = maxLevels > 1
  const labelOf = (value: string): string =>
    options.find((option) => option.value === value)?.label ?? value
  const secondaryOptions = options.filter((option) => option.value !== primary)

  const buttonLabel =
    primary === undefined
      ? "Seskupit"
      : secondary === undefined
        ? `Skupiny: ${labelOf(primary)}`
        : `Skupiny: ${labelOf(primary)} > ${labelOf(secondary)}`

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium transition-colors duration-150",
            focusRing,
            primary !== undefined
              ? "border-primary/30 bg-primary-soft text-primary"
              : "border-border bg-surface text-muted hover:border-border-strong hover:text-foreground",
          )}
        >
          <Layers className="size-3.5" />
          {buttonLabel}
          <ChevronDown className="size-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-auto p-0">
        <div className="flex flex-col gap-1 p-1.5">
          {nested ? (
            <span className="px-2 pt-1 text-[11px] font-semibold uppercase tracking-wide text-muted-soft">
              1. úroveň
            </span>
          ) : null}
          <SingleOptionList
            options={options}
            value={primary}
            allLabel="Bez seskupení"
            onSelect={(value) => {
              if (value === null) {
                onChange([])
                setOpen(false)

                return
              }

              onChange(secondary !== undefined && secondary !== value ? [value, secondary] : [value])
              if (!nested) {
                setOpen(false)
              }
            }}
          />
          {nested && primary !== undefined ? (
            <>
              <span className="px-2 pt-1 text-[11px] font-semibold uppercase tracking-wide text-muted-soft">
                2. úroveň
              </span>
              <SingleOptionList
                options={secondaryOptions}
                value={secondary}
                allLabel="Bez druhé úrovně"
                onSelect={(value) => {
                  onChange(value === null ? [primary] : [primary, value])
                  setOpen(false)
                }}
              />
            </>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  )
}

interface DateRangeFilterProps {
  start: string | undefined
  end: string | undefined
  onApply: (start: string | null, end: string | null) => void
}

function DateRangeFilter({ start, end, onApply }: DateRangeFilterProps) {
  const [from, setFrom] = useState(start ?? "")
  const [to, setTo] = useState(end ?? "")

  return (
    <div className="flex w-64 flex-col gap-3 p-3">
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-muted">Od</span>
        <DatePicker value={from.length > 0 ? from : null} onChange={setFrom} placeholder="Od" />
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-muted">Do</span>
        <DatePicker value={to.length > 0 ? to : null} onChange={setTo} placeholder="Do" />
      </div>
      <div className="flex items-center justify-between gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setFrom("")
            setTo("")
            onApply(null, null)
          }}
        >
          Vymazat
        </Button>
        <Button size="sm" onClick={() => onApply(from.length > 0 ? from : null, to.length > 0 ? to : null)}>
          Použít
        </Button>
      </div>
    </div>
  )
}

interface ViewTabsBarProps {
  viewTabs: BrowserViewTabs
  onSelect: (value: string) => void
}

function ViewTabsBar({ viewTabs, onSelect }: ViewTabsBarProps) {
  return (
    <div
      role="tablist"
      className="flex w-full items-center gap-1 overflow-x-auto rounded-full border border-hairline bg-surface-2 p-1"
    >
      {viewTabs.tabs.map((tab) => {
        const active = tab.value === viewTabs.current
        const alert = tab.alert === true && tab.count > 0

        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            onClick={() => onSelect(tab.value)}
            aria-selected={active}
            className={cn(
              "inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors duration-150",
              focusRing,
              active ? "bg-surface text-foreground shadow-soft" : "text-muted hover:text-foreground",
            )}
          >
            {tab.label}
            <span
              className={cn(
                "inline-flex min-w-[1.25rem] items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums",
                alert
                  ? "bg-red-soft text-red-text"
                  : active
                    ? "bg-surface-3/70 text-muted"
                    : "bg-surface-3/60 text-muted-soft",
              )}
            >
              {tab.count}
            </span>
          </button>
        )
      })}
    </div>
  )
}
