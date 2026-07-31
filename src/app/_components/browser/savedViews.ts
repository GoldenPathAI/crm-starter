export interface SavedView {
  id: string
  name: string
  query: string
  // The user's default view for this page: applied automatically on a bare URL.
  isDefault: boolean
}

// Pagination is transient browsing state, not part of a view; a saved view
// captures filters, search, sort, group and view tab only. Sorting the entries
// makes the string a canonical identity for active-view matching. Pure, no storage:
// stays importable from Browser.tsx and the RSC pages.
export function normalizeBrowserQuery(query: string): string {
  const params = new URLSearchParams(query)
  params.delete("page")
  params.delete("pageSize")
  const entries = [...params.entries()].sort(([aKey, aValue], [bKey, bValue]) =>
    aKey === bKey ? aValue.localeCompare(bValue) : aKey.localeCompare(bKey),
  )
  const normalized = new URLSearchParams()
  for (const [key, value] of entries) {
    normalized.append(key, value)
  }
  return normalized.toString()
}
