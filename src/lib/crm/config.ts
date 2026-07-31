import type { ColorToken } from "@/core/types/crm.types"

export interface BadgeStyle {
  label: string
  dot: string
  badge: string
}

const SLATE = { dot: "bg-border-strong", badge: "bg-surface-3/60 text-muted" } as const
const BLUE = { dot: "bg-blue", badge: "bg-blue-soft text-blue-text" } as const
const GREEN = { dot: "bg-green", badge: "bg-green-soft text-green-text" } as const
const ORANGE = { dot: "bg-orange", badge: "bg-orange-soft text-orange-text" } as const
const RED = { dot: "bg-red", badge: "bg-red-soft text-red-text" } as const
const PURPLE = { dot: "bg-purple", badge: "bg-purple-soft text-purple-text" } as const
const TEAL = { dot: "bg-teal", badge: "bg-teal-soft text-teal-text" } as const
const INDIGO = { dot: "bg-indigo", badge: "bg-indigo-soft text-indigo-text" } as const
const CYAN = { dot: "bg-cyan", badge: "bg-cyan-soft text-cyan-text" } as const

const COLOR: Record<ColorToken, Omit<BadgeStyle, "label">> = {
  slate: SLATE,
  blue: BLUE,
  green: GREEN,
  orange: ORANGE,
  red: RED,
  purple: PURPLE,
  teal: TEAL,
  indigo: INDIGO,
  cyan: CYAN,
}

// Style for a single per-org option row. This is the option-driven counterpart of
// styleMap and the target state: components take EnumOption props and style through
// here, so custom org values get colors without any static map.
export function optionBadgeStyle(option: { label: string; color: ColorToken }): BadgeStyle {
  return { label: option.label, ...COLOR[option.color] }
}

// Rows can reference an option value that was archived later (option lists exclude
// archived rows). Render those neutrally with the raw value as label instead of crashing.
export function badgeStyleFor(value: string, styles: Record<string, BadgeStyle>): BadgeStyle {
  return styles[value] ?? { label: value, ...SLATE }
}

// Deterministic chip color per calendar owner: the index in the workspace owner list
// maps to a token, wrapping when the team outgrows the palette.
const OWNER_COLOR_ORDER: readonly ColorToken[] = [
  "blue",
  "purple",
  "teal",
  "orange",
  "indigo",
  "cyan",
  "green",
  "red",
  "slate",
]

export function calendarOwnerStyle(index: number): Omit<BadgeStyle, "label"> {
  return COLOR[OWNER_COLOR_ORDER[index % OWNER_COLOR_ORDER.length] ?? "slate"]
}

// Turns an org's enum options into its label + badge-style map, resolving each
// option's color token to the Tailwind classes. This is the ONLY place values gain
// styling.
export const styleMap = <const T extends ReadonlyArray<{ value: string; label: string; color: ColorToken }>>(
  options: T,
): Record<T[number]["value"], BadgeStyle> => {
  const entries = options.map((option) => [option.value, { label: option.label, ...COLOR[option.color] }])
  return Object.fromEntries(entries) as Record<T[number]["value"], BadgeStyle>
}

export { todayIso } from "@/lib/dates"
