// URL values of the projects list. Plain module, so the server page and the client
// table read the same tuples.

export const PROJECT_SORT_FIELDS = ["name", "due", "status"] as const
export type ProjectSortField = (typeof PROJECT_SORT_FIELDS)[number]

export const PROJECT_GROUP_VALUES = ["status", "klient"] as const
export type ProjectGroupValue = (typeof PROJECT_GROUP_VALUES)[number]
