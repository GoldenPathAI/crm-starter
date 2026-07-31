export enum SortDirection {
  Asc = "Asc",
  Desc = "Desc",
}

export type SortOption<TField extends string> = {
  field: TField
  direction: SortDirection
}

export type ListQuery<TFilters, TSortField extends string> = {
  filters?: TFilters
  sort?: SortOption<TSortField>
  page?: number
  pageSize?: number
}

export type Paginated<TItem> = {
  items: TItem[]
  total: number
  page: number
  pageSize: number
}
