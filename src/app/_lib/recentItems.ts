// Shared personalization types for the command palette. Storage lives server-side
// (crm.user_recent_items / crm.user_pinned_clients) behind server actions; these
// types stay importable from client components.

export const RECENT_ITEM_TYPES = ["client", "deal", "project", "ticket"] as const

export type RecentItemType = (typeof RECENT_ITEM_TYPES)[number]

export interface RecentItem {
  type: RecentItemType
  id: string
  title: string
  href: string
}

export interface PinnedClient {
  id: string
  title: string
  href: string
}
