import { SortDirection } from "@/core/types/query.types"

// Shared searchParams parsing primitives. Every list surface parses its URL the
// same way: single scalars, comma-or-repeat multi-values, enum coercion, page.
export type BrowserSearchParams = Record<string, string | string[] | undefined>

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

export const single = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value

export const matchEnum = <T extends string>(
  value: string | undefined,
  allowed: readonly T[],
): T | undefined =>
  value !== undefined ? allowed.find((candidate) => candidate === value) : undefined

export const cleanText = (value: string | undefined): string | undefined => {
  if (value === undefined) {
    return undefined
  }
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

export const cleanList = (value: string | string[] | undefined): string[] => [
  ...new Set(
    (Array.isArray(value) ? value : value !== undefined ? [value] : [])
      .flatMap((entry) => entry.split(","))
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0),
  ),
]

export const enumList = <T extends string>(
  value: string | string[] | undefined,
  allowed: readonly T[],
): T[] =>
  cleanList(value).filter((entry): entry is T =>
    allowed.some((candidate) => candidate === entry),
  )

export const cleanIsoDate = (value: string | undefined): string | undefined => {
  const trimmed = cleanText(value)
  return trimmed !== undefined && ISO_DATE.test(trimmed) ? trimmed : undefined
}

export const parsePage = (value: string | undefined): number => {
  if (value === undefined) {
    return 1
  }
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1
}

export const parseSortDir = (value: string | undefined): SortDirection =>
  value === SortDirection.Desc ? SortDirection.Desc : SortDirection.Asc

// Parse the `group` param for a surface that supports up to `maxLevels` nested
// levels, a default view when the param is absent, and an explicit `none`
// sentinel that suppresses the default (written when the user removes grouping).
// Absent -> the default levels; literal `none` -> no grouping; otherwise the
// comma-or-repeat list coerced to `allowed`, deduped and capped at `maxLevels`.
export const parseGroupLevels = <T extends string>(
  value: string | string[] | undefined,
  allowed: readonly T[],
  options: { default: readonly T[]; maxLevels: number },
): T[] => {
  if (single(value) === "none") {
    return []
  }
  if (value === undefined) {
    return options.default.slice(0, options.maxLevels)
  }
  return enumList(value, allowed).slice(0, options.maxLevels)
}
