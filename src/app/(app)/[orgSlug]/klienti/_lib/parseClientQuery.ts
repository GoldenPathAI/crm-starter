import { SortDirection } from "@/core/types/query.types"
import {
  cleanList,
  cleanText,
  matchEnum,
  parseGroupLevels,
  parsePage,
  single,
} from "@/app/_components/browser/queryHelpers"
import type { ClientListFilters, ClientListQuery } from "@/lib/crm/store/clients"
import { CLIENT_GROUP_FIELDS, CLIENT_SORT_FIELDS, type ClientGroupField } from "@/core/listFields"

export type ClientSearchParams = Record<string, string | string[] | undefined>

export const CLIENT_GROUP_MAX_LEVELS = 2

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
