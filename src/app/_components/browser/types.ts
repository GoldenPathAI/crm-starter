import type { ReactNode } from "react"
import type { LucideIcon } from "lucide-react"
import type { SortDirection } from "@/core/types/query.types"

// One selectable value inside a checkbox / single-select column filter or a
// group menu. `dotClassName` paints the small status dot next to the label.
export interface BrowserFilterOption {
  value: string
  label: string
  dotClassName?: string
}

// A column filter drives one or more URL params. `label` is used both as the
// popover aria-label and as the chip title.
export type BrowserColumnFilter =
  | {
      kind: "checkbox"
      paramKey: string
      label: string
      options: BrowserFilterOption[]
      selected: ReadonlyArray<string>
    }
  | {
      kind: "single"
      paramKey: string
      label: string
      allLabel: string
      options: BrowserFilterOption[]
      value: string | undefined
    }
  | {
      kind: "dateRange"
      startKey: string
      endKey: string
      label: string
      start: string | undefined
      end: string | undefined
      formatValue?: (iso: string) => string
    }

// A single column. `header` is the plain label rendered in the TH; when
// `sortField` is set the label becomes a tri-state sort button; when `filter`
// is set a filter popover sits next to it. `cell` renders the TD content.
export interface BrowserColumn<R> {
  id: string
  header: string
  sortField?: string
  align?: "left" | "right"
  headClassName?: string
  cellClassName?: string
  filter?: BrowserColumnFilter
  cell: (row: R, index: number) => ReactNode
}

// A quick-view preset: a bundle of params toggled on/off as a chip. Active when
// every param in `params` matches the live URL.
export interface BrowserPreset {
  key: string
  label: string
  icon?: LucideIcon
  params: Readonly<Record<string, string>>
}

// A single-select segmented view (the daily lens over úkoly). One URL param,
// counts shown per tab, `defaultValue` is stored as an absent param.
export interface BrowserViewTab {
  value: string
  label: string
  count: number
  alert?: boolean
}

export interface BrowserViewTabs {
  paramKey: string
  defaultValue: string
  current: string
  tabs: BrowserViewTab[]
}

export interface BrowserBucket<R> {
  key: string
  label: string
  dotClassName?: string
  rows: R[]
}

// Grouping config. `build` is a pure, page-supplied bucketizer for ONE level (it
// owns domain ordering like status order or "Bez X" trailing buckets); the
// Browser calls it once per active level and nests the results. `current` is the
// active level (single wrappers pass a string, nested surfaces an ordered list of
// up to `maxLevels`). `maxLevels` (default 1) gates the second-level picker in the
// GroupMenu. `clearsToNone` makes removing all grouping write an explicit `none`
// sentinel instead of dropping the param, so a page-level default does not reapply.
export interface BrowserGroupConfig<R> {
  current: string | string[] | undefined
  options: BrowserFilterOption[]
  build: (rows: R[], group: string) => BrowserBucket<R>[]
  maxLevels?: number
  clearsToNone?: boolean
}

export interface BrowserSort {
  field: string
  direction: SortDirection
}

// Opt-in multi-select mode. The page component owns the selected row-key set
// (cleared on filter/page changes) and supplies the bulk actions rendered in
// the floating bar while at least one row is selected.
export interface BrowserSelection {
  selected: ReadonlySet<string>
  onChange: (selected: ReadonlySet<string>) => void
  actions: ReactNode
}

export interface BrowserEmpty {
  icon: ReactNode
  title: string
  description: string
}
