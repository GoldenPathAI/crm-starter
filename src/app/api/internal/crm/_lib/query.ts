import { SortDirection } from "@/core/types/query.types"
import {
  CLIENT_GROUP_FIELDS,
  CLIENT_SORT_FIELDS,
  RAPPORT_SORT_FIELDS,
  TICKET_GROUP_FIELDS,
  TICKET_SORT_FIELDS,
} from "@/core/listFields"
import type { OrgEnums } from "@/lib/crm/enums/service"
import type { ClientListFilters, ClientListQuery } from "@/lib/crm/store/clients"
import type { RapportPeopleQuery } from "@/lib/crm/store/people"
import type { TicketListFilters, TicketListQuery } from "@/lib/crm/store/tickets"
import type { EnumKind } from "@/core/types/crm.types"

const single = (params: URLSearchParams, key: string): string | undefined => {
  const value = params.get(key)
  if (value === null) {
    return undefined
  }

  const trimmed = value.trim()

  return trimmed.length > 0 ? trimmed : undefined
}

const list = (params: URLSearchParams, key: string): string[] => [
  ...new Set(
    params
      .getAll(key)
      .flatMap((entry) => entry.split(","))
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0),
  ),
]

const enumSingle = <T extends string>(
  params: URLSearchParams,
  key: string,
  allowed: readonly T[],
): T | undefined => {
  const value = single(params, key)

  return value !== undefined ? allowed.find((candidate) => candidate === value) : undefined
}

const orgEnumList = (
  params: URLSearchParams,
  key: string,
  enums: OrgEnums,
  kind: EnumKind,
): string[] =>
  list(params, key).filter((entry) => enums[kind].some((option) => option.value === entry))

const parsePage = (params: URLSearchParams): number => {
  const value = single(params, "page")
  if (value === undefined) {
    return 1
  }

  const parsed = Number.parseInt(value, 10)

  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1
}

const parseDirection = (params: URLSearchParams): SortDirection => {
  const value = single(params, "sortDir")?.toLowerCase()

  return value === "desc" ? SortDirection.Desc : SortDirection.Asc
}

export function buildClientListQuery(params: URLSearchParams, enums: OrgEnums): ClientListQuery {
  const statuses = orgEnumList(params, "status", enums, "client_status")
  const services = orgEnumList(params, "service", enums, "service_kind")
  const industries = list(params, "industry")
  const q = single(params, "q")

  const filters: ClientListFilters = {
    ...(statuses.length > 0 ? { statuses } : {}),
    ...(services.length > 0 ? { services } : {}),
    ...(industries.length > 0 ? { industries } : {}),
    ...(q !== undefined ? { q } : {}),
  }

  const sortField = enumSingle(params, "sortField", CLIENT_SORT_FIELDS)
  const group = enumSingle(params, "group", CLIENT_GROUP_FIELDS)

  return {
    filters,
    sort: sortField !== undefined ? { field: sortField, direction: parseDirection(params) } : undefined,
    group,
    page: parsePage(params),
  }
}

export function buildRapportPeopleQuery(
  params: URLSearchParams,
  enums: OrgEnums,
): RapportPeopleQuery {
  const kinds = orgEnumList(params, "kind", enums, "person_kind")
  const q = single(params, "q")
  const sortField = enumSingle(params, "sortField", RAPPORT_SORT_FIELDS)

  return {
    ...(kinds.length > 0 ? { kinds } : {}),
    ...(q !== undefined ? { q } : {}),
    ...(sortField !== undefined
      ? { sort: { field: sortField, direction: parseDirection(params) } }
      : {}),
  }
}

export function buildTicketListQuery(params: URLSearchParams, enums: OrgEnums): TicketListQuery {
  const clientId = single(params, "clientId")
  const projectId = single(params, "projectId")
  const dealId = single(params, "dealId")
  const statuses = orgEnumList(params, "status", enums, "ticket_status")
  const priorities = orgEnumList(params, "priority", enums, "ticket_priority")
  const overdueRaw = single(params, "overdue")
  const overdue = overdueRaw === "1" || overdueRaw === "true"

  const filters: TicketListFilters = {
    ...(clientId !== undefined ? { clientId } : {}),
    ...(projectId !== undefined ? { projectId } : {}),
    ...(dealId !== undefined ? { dealId } : {}),
    ...(statuses.length > 0 ? { statuses } : {}),
    ...(priorities.length > 0 ? { priorities } : {}),
    ...(overdue ? { overdue } : {}),
  }

  const sortField = enumSingle(params, "sortField", TICKET_SORT_FIELDS)
  const group = enumSingle(params, "group", TICKET_GROUP_FIELDS)

  return {
    filters,
    sort: sortField !== undefined ? { field: sortField, direction: parseDirection(params) } : undefined,
    group,
    page: parsePage(params),
  }
}
