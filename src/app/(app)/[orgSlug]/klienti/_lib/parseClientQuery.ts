import { SortDirection } from "@/core/types/query.types"
import { parseGroupLevels } from "@/app/_components/browser/queryHelpers"
import type { ClientGroupField, ClientListFilters, ClientListQuery, ClientSortField } from "@/lib/crm/store/clients"

export type ClientSearchParams = Record<string, string | string[] | undefined>

const CLIENT_SORT_FIELDS: ReadonlyArray<ClientSortField> = [
  "name",
  "mrr",
  "lastContactAt",
  "pipeline",
]
const CLIENT_GROUP_FIELDS: ReadonlyArray<ClientGroupField> = ["status", "service", "industry"]

export const CLIENT_GROUP_MAX_LEVELS = 2

const single = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value

const matchEnum = <T extends string>(
  value: string | undefined,
  allowed: readonly T[],
): T | undefined =>
  value !== undefined ? allowed.find((candidate) => candidate === value) : undefined

const cleanText = (value: string | undefined): string | undefined => {
  if (value === undefined) {
    return undefined
  }

  const trimmed = value.trim()

  return trimmed.length > 0 ? trimmed : undefined
}

const cleanList = (value: string | string[] | undefined): string[] =>
  [
    ...new Set(
      (Array.isArray(value) ? value : value !== undefined ? [value] : [])
        .flatMap((entry) => entry.split(","))
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0),
    ),
  ]

const parsePage = (value: string | undefined): number => {
  if (value === undefined) {
    return 1
  }

  const parsed = Number.parseInt(value, 10)

  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1
}

// Active group levels, primary first. The parse-level default is empty: the
// bare-URL resting default injects `group=status` through effectiveParams, so
// an explicit URL without a group param stays ungrouped, exactly as before.
export function parseClientGroups(params: ClientSearchParams): ClientGroupField[] {
  return parseGroupLevels(params.group, CLIENT_GROUP_FIELDS, {
    default: [],
    maxLevels: CLIENT_GROUP_MAX_LEVELS,
  })
}

export function parseClientQuery(params: ClientSearchParams): ClientListQuery {
  const sortField = matchEnum(single(params.sortField), CLIENT_SORT_FIELDS)
  const sortDir = matchEnum(single(params.sortDir), Object.values(SortDirection))

  const statuses = cleanList(params.status)
  const services = cleanList(params.service)
  const industries = cleanList(params.industry)
  const labels = cleanList(params.label)
  const q = cleanText(single(params.q))

  const filters: ClientListFilters = {
    ...(statuses.length > 0 ? { statuses } : {}),
    ...(services.length > 0 ? { services } : {}),
    ...(industries.length > 0 ? { industries } : {}),
    ...(labels.length > 0 ? { labels } : {}),
    ...(q !== undefined ? { q } : {}),
  }

  return {
    filters,
    sort:
      sortField !== undefined
        ? { field: sortField, direction: sortDir ?? SortDirection.Asc }
        : undefined,
    page: parsePage(single(params.page)),
  }
}
