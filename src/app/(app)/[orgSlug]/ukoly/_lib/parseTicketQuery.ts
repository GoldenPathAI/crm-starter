import { SortDirection } from "@/core/types/query.types"
import { parseGroupLevels } from "@/app/_components/browser/queryHelpers"

export type TicketSearchParams = Record<string, string | string[] | undefined>

export type TicketTableSortField = "due" | "title" | "priority"

// The primary daily lens over the ticket list. Presets partition tickets by
// urgency so the morning question "na cem delam dnes" is answered in zero clicks.
export type TicketView = "otevrene" | "po-terminu" | "dnes" | "tyden" | "bez-terminu" | "hotove"

export const TICKET_VIEWS: ReadonlyArray<TicketView> = [
  "otevrene",
  "po-terminu",
  "dnes",
  "tyden",
  "bez-terminu",
  "hotove",
]

export const DEFAULT_TICKET_VIEW: TicketView = "otevrene"

export interface TicketQueryState {
  statuses: string[]
  priorities: string[]
  clientIds: string[]
  assigneeIds: string[]
  view: TicketView
  q: string
  sortField?: TicketTableSortField
  sortDir: SortDirection
  // Active group levels as URL values, primary first. A bare URL gets the
  // default Klient > Řešitel lens; `group=none` means explicitly ungrouped.
  groups: TicketGroupValue[]
  page: number
}

export type TicketGroupValue = "status" | "klient" | "priorita" | "resitel"

export const TICKET_GROUP_VALUES: ReadonlyArray<TicketGroupValue> = [
  "status",
  "klient",
  "priorita",
  "resitel",
]

export const DEFAULT_TICKET_GROUPS: ReadonlyArray<TicketGroupValue> = ["klient", "resitel"]

export const TICKET_GROUP_MAX_LEVELS = 2

const SORT_FIELDS: ReadonlyArray<TicketTableSortField> = ["due", "title", "priority"]

const single = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value

const cleanText = (value: string | undefined): string => value?.trim() ?? ""

const cleanList = (value: string | string[] | undefined): string[] =>
  (Array.isArray(value) ? value : value !== undefined ? [value] : [])
    .flatMap((entry) => entry.split(","))
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)

const allowedList = (value: string | string[] | undefined, allowed: readonly string[]): string[] => {
  const matched = cleanList(value).filter((entry) => allowed.includes(entry))

  return [...new Set(matched)]
}

const parsePage = (value: string | undefined): number => {
  if (value === undefined) {
    return 1
  }

  const parsed = Number.parseInt(value, 10)

  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1
}

export function parseTicketQuery(
  params: TicketSearchParams,
  statusValues: readonly string[],
  priorityValues: readonly string[],
): TicketQueryState {
  const statuses = allowedList(params.status, statusValues)
  const priorities = allowedList(params.priorita, priorityValues)
  const clientIds = [...new Set(cleanList(params.klient))]
  const assigneeIds = [...new Set(cleanList(params.resitel))]
  const viewRaw = single(params.zobrazit)
  const view = TICKET_VIEWS.find((candidate) => candidate === viewRaw) ?? DEFAULT_TICKET_VIEW
  const sortFieldRaw = single(params.sortField)
  const sortField = SORT_FIELDS.find((field) => field === sortFieldRaw)
  const sortDir =
    single(params.sortDir) === SortDirection.Desc ? SortDirection.Desc : SortDirection.Asc
  const groups = parseGroupLevels(params.group, TICKET_GROUP_VALUES, {
    default: DEFAULT_TICKET_GROUPS,
    maxLevels: TICKET_GROUP_MAX_LEVELS,
  })

  return {
    statuses,
    priorities,
    clientIds,
    assigneeIds,
    view,
    q: cleanText(single(params.q)),
    sortField,
    sortDir,
    groups,
    page: parsePage(single(params.page)),
  }
}
