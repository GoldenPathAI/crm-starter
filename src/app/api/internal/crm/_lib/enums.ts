import type { ClientGroupField, ClientSortField } from "@/lib/crm/store/clients"
import type { RapportSortField } from "@/lib/crm/store/people"
import type { TicketGroupField, TicketSortField } from "@/lib/crm/store/tickets"

// Enum values are per-org data now, validated at the boundary against the org's
// loaded enum options (see parse-body.ts / query.ts). Only the sort and group keys
// stay here: they are code fields, not enum data, so they are the same for every org.

export const CLIENT_SORT_FIELDS: readonly ClientSortField[] = [
  "name",
  "mrr",
  "lastContactAt",
  "pipeline",
]

export const CLIENT_GROUP_FIELDS: readonly ClientGroupField[] = ["status", "service", "industry"]

export const TICKET_SORT_FIELDS: readonly TicketSortField[] = ["dueAt", "priority", "createdAt"]

export const TICKET_GROUP_FIELDS: readonly TicketGroupField[] = ["status", "client", "priority"]

export const RAPPORT_SORT_FIELDS: readonly RapportSortField[] = [
  "name",
  "createdAt",
  "lastEntryAt",
]
