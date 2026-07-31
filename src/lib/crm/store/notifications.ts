import { and, desc, eq, isNull, sql } from "drizzle-orm"
import { resolveDbc } from "@/lib/crm/store/db"
import { notifications } from "@/lib/db/schema/notifications"
import { createId } from "@/lib/ids"
import type {
  Notification,
  NotificationEntityType,
  OrgScope,
} from "@/core/types/crm.types"

type NotificationRow = typeof notifications.$inferSelect

const ENTITY_TYPES: readonly NotificationEntityType[] = ["ticket", "deal", "client", "project"]

const asEntityType = (value: string | null): NotificationEntityType | undefined =>
  ENTITY_TYPES.find((candidate) => candidate === value)

const toNotification = (row: NotificationRow): Notification => ({
  id: row.id,
  organizationId: row.organizationId,
  userId: row.userId,
  type: row.type,
  title: row.title,
  body: row.body ?? undefined,
  entityType: asEntityType(row.entityType),
  entityId: row.entityId ?? undefined,
  readAt: row.readAt?.toISOString(),
  createdAt: row.createdAt.toISOString(),
})

export interface CreateNotificationInput {
  userId: string
  type: string
  title: string
  body?: string
  entityType?: NotificationEntityType
  entityId?: string
}

export async function createNotification(
  scope: OrgScope,
  input: CreateNotificationInput,
): Promise<Notification> {
  const dbc = resolveDbc(scope)
  const rows = await dbc
    .insert(notifications)
    .values({
      id: createId("ntf"),
      organizationId: scope.orgId,
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
    })
    .returning()
  const row = rows[0]
  if (row === undefined) {
    throw new Error("Notifikaci se nepodařilo vytvořit.")
  }
  return toNotification(row)
}

export async function listNotifications(
  scope: OrgScope,
  userId: string,
  options: { limit?: number } = {},
): Promise<Notification[]> {
  const dbc = resolveDbc(scope)
  const rows = await dbc
    .select()
    .from(notifications)
    .where(and(eq(notifications.organizationId, scope.orgId), eq(notifications.userId, userId)))
    .orderBy(desc(notifications.createdAt))
    .limit(options.limit ?? 30)
  return rows.map(toNotification)
}

export async function unreadCount(scope: OrgScope, userId: string): Promise<number> {
  const dbc = resolveDbc(scope)
  const rows = await dbc
    .select({ count: sql<number>`count(*)::int` })
    .from(notifications)
    .where(
      and(
        eq(notifications.organizationId, scope.orgId),
        eq(notifications.userId, userId),
        isNull(notifications.readAt),
      ),
    )
  return rows[0]?.count ?? 0
}

export async function markRead(scope: OrgScope, userId: string, id: string): Promise<void> {
  const dbc = resolveDbc(scope)
  await dbc
    .update(notifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(notifications.id, id),
        eq(notifications.organizationId, scope.orgId),
        eq(notifications.userId, userId),
        isNull(notifications.readAt),
      ),
    )
}

export async function markAllRead(scope: OrgScope, userId: string): Promise<void> {
  const dbc = resolveDbc(scope)
  await dbc
    .update(notifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(notifications.organizationId, scope.orgId),
        eq(notifications.userId, userId),
        isNull(notifications.readAt),
      ),
    )
}

export interface AssignmentNotificationInput {
  recipientUserIds: string[]
  type: "ticket_assigned" | "deal_assigned"
  entityType: Extract<NotificationEntityType, "ticket" | "deal">
  entityId: string
  entityTitle: string
}

// Persists one in-app notification per newly-assigned recipient, inside the caller's
// scope so it can share an open transaction.
export async function notifyAssignment(
  scope: OrgScope,
  input: AssignmentNotificationInput,
): Promise<void> {
  if (input.recipientUserIds.length === 0) {
    return
  }
  const title =
    input.entityType === "ticket"
      ? `Byl ti přiřazen úkol ${input.entityTitle}`
      : `Byl ti přiřazen deal ${input.entityTitle}`

  for (const userId of input.recipientUserIds) {
    await createNotification(scope, {
      userId,
      type: input.type,
      title,
      entityType: input.entityType,
      entityId: input.entityId,
    })
  }
}
