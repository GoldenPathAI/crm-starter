// Sort and group keys of the store list queries. They are code fields, not per-org enum
// data, so they are the same for every workspace. They travel in URLs, saved views and
// the internal API query string, which is why they are typed from readonly tuples and
// keep their spelling. Plain module, so client components can read the values too.

export const CLIENT_SORT_FIELDS = ["name", "mrr", "lastContactAt", "pipeline"] as const
export type ClientSortField = (typeof CLIENT_SORT_FIELDS)[number]

export const CLIENT_GROUP_FIELDS = ["status", "service", "industry"] as const
export type ClientGroupField = (typeof CLIENT_GROUP_FIELDS)[number]

export const TICKET_SORT_FIELDS = ["dueAt", "priority", "createdAt"] as const
export type TicketSortField = (typeof TICKET_SORT_FIELDS)[number]

export const TICKET_GROUP_FIELDS = ["status", "client", "priority"] as const
export type TicketGroupField = (typeof TICKET_GROUP_FIELDS)[number]

export const RAPPORT_SORT_FIELDS = ["name", "createdAt", "lastEntryAt"] as const
export type RapportSortField = (typeof RAPPORT_SORT_FIELDS)[number]
