"use server"

import { requireOrgContext } from "@/lib/auth/org-context"
import {
  listNotifications,
  markAllRead,
  markRead,
  unreadCount,
} from "@/lib/crm/store/notifications"
import type { Notification } from "@/core/types/crm.types"

export interface NotificationsSnapshot {
  items: Notification[]
  unread: number
}

export async function fetchNotificationsAction(orgSlug: string): Promise<NotificationsSnapshot> {
  const ctx = await requireOrgContext(orgSlug)
  const [items, unread] = await Promise.all([
    listNotifications(ctx.scope, ctx.user.id, { limit: 30 }),
    unreadCount(ctx.scope, ctx.user.id),
  ])
  return { items, unread }
}

export async function unreadCountAction(orgSlug: string): Promise<number> {
  const ctx = await requireOrgContext(orgSlug)
  return unreadCount(ctx.scope, ctx.user.id)
}

export async function markNotificationReadAction(orgSlug: string, id: string): Promise<number> {
  const ctx = await requireOrgContext(orgSlug)
  await markRead(ctx.scope, ctx.user.id, id)
  return unreadCount(ctx.scope, ctx.user.id)
}

export async function markAllNotificationsReadAction(orgSlug: string): Promise<void> {
  const ctx = await requireOrgContext(orgSlug)
  await markAllRead(ctx.scope, ctx.user.id)
}
