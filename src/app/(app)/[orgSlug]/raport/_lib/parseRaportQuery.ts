import {
  cleanList,
  cleanText,
  matchEnum,
  parseGroupLevels,
  parseSortDir,
  single,
  type BrowserSearchParams,
} from "@/app/_components/browser/queryHelpers"
import type { RapportPeopleQuery } from "@/lib/crm/store/people"
import { RAPPORT_SORT_FIELDS } from "@/core/listFields"

export type RaportSearchParams = BrowserSearchParams


export const RAPPORT_GROUP_FIELDS = ["kind", "client"] as const
export type RaportGroupField = (typeof RAPPORT_GROUP_FIELDS)[number]

export const RAPPORT_GROUP_MAX_LEVELS = 2

// The bare URL rests on grouping by person type, like klienti rests on status.
export function parseRaportGroups(params: RaportSearchParams): RaportGroupField[] {
  return parseGroupLevels(params.group, RAPPORT_GROUP_FIELDS, {
    default: ["kind"],
    maxLevels: RAPPORT_GROUP_MAX_LEVELS,
  })
}

export function parseRaportQuery(params: RaportSearchParams): RapportPeopleQuery {
  const kinds = cleanList(params.kind)
  const q = cleanText(single(params.q))
  const sortField = matchEnum(single(params.sortField), RAPPORT_SORT_FIELDS)

  return {
    ...(kinds.length > 0 ? { kinds } : {}),
    ...(q !== undefined ? { q } : {}),
    ...(sortField !== undefined
      ? { sort: { field: sortField, direction: parseSortDir(single(params.sortDir)) } }
      : {}),
  }
}
