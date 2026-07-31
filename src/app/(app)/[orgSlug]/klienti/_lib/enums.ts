import { badgeStyleFor, styleMap, type BadgeStyle } from "@/lib/crm/config"
import type { EnumOption } from "@/core/types/crm.types"

// A per-org enum set ready for the UI: the ordered options plus their resolved badge
// styles. Serializable, so it crosses the server -> client boundary as a plain prop.
// Styling flows entirely through config (styleMap + badgeStyleFor); this only bundles
// the fetched options with their prebuilt style map so components take a single prop.
export interface EnumView {
  options: EnumOption[]
  styles: Record<string, BadgeStyle>
}

export const toEnumView = (options: EnumOption[]): EnumView => ({
  options,
  styles: styleMap(options),
})

export const badgeFor = (view: EnumView, value: string): BadgeStyle =>
  badgeStyleFor(value, view.styles)

export const selectOptions = (view: EnumView): { value: string; label: string }[] =>
  view.options.map((option) => ({ value: option.value, label: option.label }))

export const isKnownValue = (view: EnumView, value: string): boolean =>
  view.options.some((option) => option.value === value)
