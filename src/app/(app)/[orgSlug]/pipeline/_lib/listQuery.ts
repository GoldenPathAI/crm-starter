// URL values of the pipeline page. Plain module, so the server page and the client
// list read the same tuples.

export const PIPELINE_VIEWS = ["kanban", "list"] as const
export type PipelineView = (typeof PIPELINE_VIEWS)[number]

export const DEAL_LIST_SORT_FIELDS = ["hodnota", "dni", "uzavreni"] as const
export type DealListSortField = (typeof DEAL_LIST_SORT_FIELDS)[number]

export const DEAL_LIST_GROUPS = ["faze", "klient"] as const
export type DealListGroup = (typeof DEAL_LIST_GROUPS)[number]
