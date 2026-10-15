import { and, desc, eq, notInArray } from "drizzle-orm"
import { resolveDbc } from "@/lib/crm/store/db"
import { clients } from "@/lib/db/schema/crm"
import {
  userPinnedClients,
  userRecentItems,
  userSavedViews,
} from "@/lib/db/schema/userPersonalization"
import { createId } from "@/lib/ids"
import {
  RECENT_ITEM_TYPES,
  type PinnedClient,
  type RecentItem,
  type RecentItemType,
} from "@/app/_lib/recentItems"
import type { SavedView } from "@/app/_components/browser/savedViews"
import type { OrgScope } from "@/core/types/crm.types"

const RECENT_LIMIT = 8
const PIN_LIMIT = 12
const VIEW_LIMIT = 20

const isRecentItemType = (value: string): value is RecentItemType =>
  (RECENT_ITEM_TYPES as readonly string[]).includes(value)

export interface RecordRecentItemInput {
  itemType: RecentItemType
  entityId: string
  title: string
  href: string
}

export async function listRecentItems(
  scope: OrgScope,
  userId: string,
  limit = RECENT_LIMIT,
): Promise<RecentItem[]> {
  const dbc = resolveDbc(scope)
  const rows = await dbc
    .select()
    .from(userRecentItems)
    .where(
      and(eq(userRecentItems.organizationId, scope.orgId), eq(userRecentItems.userId, userId)),
    )
    .orderBy(desc(userRecentItems.visitedAt))
    .limit(limit)

  return rows.flatMap((row) =>
    isRecentItemType(row.itemType)
      ? [{ type: row.itemType, id: row.entityId, title: row.title, href: row.href }]
      : [],
  )
}

export async function recordRecentItem(
  scope: OrgScope,
  userId: string,
  input: RecordRecentItemInput,
): Promise<void> {
  if (!isRecentItemType(input.itemType)) {
    throw new Error(`Neplatný typ položky: ${input.itemType}`)
  }

  const dbc = resolveDbc(scope)
  await dbc
    .insert(userRecentItems)
    .values({
      id: createId("uri"),
      organizationId: scope.orgId,
      userId,
      itemType: input.itemType,
      entityId: input.entityId,
      title: input.title,
      href: input.href,
    })
    .onConflictDoUpdate({
      target: [
        userRecentItems.organizationId,
        userRecentItems.userId,
        userRecentItems.itemType,
        userRecentItems.entityId,
      ],
      set: { visitedAt: new Date(), title: input.title, href: input.href },
    })
  await trimRecentItems(scope, userId)
}

// Keep only this user's newest RECENT_LIMIT rows, dropping the tail.
async function trimRecentItems(scope: OrgScope, userId: string): Promise<void> {
  const dbc = resolveDbc(scope)
  const keep = await dbc
    .select({ id: userRecentItems.id })
    .from(userRecentItems)
    .where(
      and(eq(userRecentItems.organizationId, scope.orgId), eq(userRecentItems.userId, userId)),
    )
    .orderBy(desc(userRecentItems.visitedAt))
    .limit(RECENT_LIMIT)
  const keepIds = keep.map((row) => row.id)
  if (keepIds.length < RECENT_LIMIT) {
    return
  }

  await dbc
    .delete(userRecentItems)
    .where(
      and(
        eq(userRecentItems.organizationId, scope.orgId),
        eq(userRecentItems.userId, userId),
        notInArray(userRecentItems.id, keepIds),
      ),
    )
}

export async function listPinnedClients(
  scope: OrgScope,
  userId: string,
  limit = PIN_LIMIT,
): Promise<PinnedClient[]> {
  const dbc = resolveDbc(scope)
  const rows = await dbc
    .select({
      clientId: userPinnedClients.clientId,
      name: clients.name,
      href: userPinnedClients.href,
    })
    .from(userPinnedClients)
    .innerJoin(clients, eq(clients.id, userPinnedClients.clientId))
    .where(
      and(eq(userPinnedClients.organizationId, scope.orgId), eq(userPinnedClients.userId, userId)),
    )
    .orderBy(desc(userPinnedClients.pinnedAt))
    .limit(limit)

  return rows.map((row) => ({ id: row.clientId, title: row.name, href: row.href }))
}

export async function isClientPinned(
  scope: OrgScope,
  userId: string,
  clientId: string,
): Promise<boolean> {
  const dbc = resolveDbc(scope)
  const rows = await dbc
    .select({ id: userPinnedClients.id })
    .from(userPinnedClients)
    .where(
      and(
        eq(userPinnedClients.organizationId, scope.orgId),
        eq(userPinnedClients.userId, userId),
        eq(userPinnedClients.clientId, clientId),
      ),
    )
    .limit(1)

  return rows.length > 0
}

export interface TogglePinnedClientInput {
  clientId: string
  href: string
}

// Returns the new pinned state after the toggle. On pin, drops the oldest rows beyond
// PIN_LIMIT so a user never accumulates more than the cap.
export async function togglePinnedClient(
  scope: OrgScope,
  userId: string,
  input: TogglePinnedClientInput,
): Promise<boolean> {
  const dbc = resolveDbc(scope)
  const alreadyPinned = await isClientPinned(scope, userId, input.clientId)
  if (alreadyPinned) {
    await dbc
      .delete(userPinnedClients)
      .where(
        and(
          eq(userPinnedClients.organizationId, scope.orgId),
          eq(userPinnedClients.userId, userId),
          eq(userPinnedClients.clientId, input.clientId),
        ),
      )

    return false
  }

  await dbc.insert(userPinnedClients).values({
    id: createId("upc"),
    organizationId: scope.orgId,
    userId,
    clientId: input.clientId,
    href: input.href,
  })
  await trimPinnedClients(scope, userId)

  return true
}

async function trimPinnedClients(scope: OrgScope, userId: string): Promise<void> {
  const dbc = resolveDbc(scope)
  const keep = await dbc
    .select({ id: userPinnedClients.id })
    .from(userPinnedClients)
    .where(
      and(eq(userPinnedClients.organizationId, scope.orgId), eq(userPinnedClients.userId, userId)),
    )
    .orderBy(desc(userPinnedClients.pinnedAt))
    .limit(PIN_LIMIT)
  const keepIds = keep.map((row) => row.id)
  if (keepIds.length < PIN_LIMIT) {
    return
  }

  await dbc
    .delete(userPinnedClients)
    .where(
      and(
        eq(userPinnedClients.organizationId, scope.orgId),
        eq(userPinnedClients.userId, userId),
        notInArray(userPinnedClients.id, keepIds),
      ),
    )
}

const toSavedView = (row: typeof userSavedViews.$inferSelect): SavedView => ({
  id: row.id,
  name: row.name,
  query: row.query,
  isDefault: row.isDefault,
})

export async function listSavedViews(
  scope: OrgScope,
  userId: string,
  pageKey: string,
  limit = VIEW_LIMIT,
): Promise<SavedView[]> {
  const dbc = resolveDbc(scope)
  const rows = await dbc
    .select()
    .from(userSavedViews)
    .where(
      and(
        eq(userSavedViews.organizationId, scope.orgId),
        eq(userSavedViews.userId, userId),
        eq(userSavedViews.pageKey, pageKey),
      ),
    )
    .orderBy(desc(userSavedViews.createdAt))
    .limit(limit)

  return rows.map(toSavedView)
}

// Saving under an existing name replaces that view (upsert on the unique key), then
// enforces the per-page cap. Returns the fresh list.
export async function saveSavedView(
  scope: OrgScope,
  userId: string,
  pageKey: string,
  name: string,
  query: string,
): Promise<SavedView[]> {
  const dbc = resolveDbc(scope)
  await dbc
    .insert(userSavedViews)
    .values({
      id: createId("usv"),
      organizationId: scope.orgId,
      userId,
      pageKey,
      name,
      query,
    })
    .onConflictDoUpdate({
      target: [
        userSavedViews.organizationId,
        userSavedViews.userId,
        userSavedViews.pageKey,
        userSavedViews.name,
      ],
      set: { query, createdAt: new Date() },
    })
  await trimSavedViews(scope, userId, pageKey)

  return listSavedViews(scope, userId, pageKey)
}

async function trimSavedViews(scope: OrgScope, userId: string, pageKey: string): Promise<void> {
  const dbc = resolveDbc(scope)
  const keep = await dbc
    .select({ id: userSavedViews.id })
    .from(userSavedViews)
    .where(
      and(
        eq(userSavedViews.organizationId, scope.orgId),
        eq(userSavedViews.userId, userId),
        eq(userSavedViews.pageKey, pageKey),
      ),
    )
    .orderBy(desc(userSavedViews.createdAt))
    .limit(VIEW_LIMIT)
  const keepIds = keep.map((row) => row.id)
  if (keepIds.length < VIEW_LIMIT) {
    return
  }

  await dbc
    .delete(userSavedViews)
    .where(
      and(
        eq(userSavedViews.organizationId, scope.orgId),
        eq(userSavedViews.userId, userId),
        eq(userSavedViews.pageKey, pageKey),
        notInArray(userSavedViews.id, keepIds),
      ),
    )
}

// Marks one view as the user's default for the page (clearing any previous default),
// or unmarks it when `isDefault` is false. The partial unique index backs this up at
// the DB level; the clear-then-set order keeps the transaction conflict-free.
export async function setDefaultSavedView(
  scope: OrgScope,
  userId: string,
  pageKey: string,
  id: string,
  isDefault: boolean,
): Promise<SavedView[]> {
  const dbc = resolveDbc(scope)
  await dbc
    .update(userSavedViews)
    .set({ isDefault: false })
    .where(
      and(
        eq(userSavedViews.organizationId, scope.orgId),
        eq(userSavedViews.userId, userId),
        eq(userSavedViews.pageKey, pageKey),
        eq(userSavedViews.isDefault, true),
      ),
    )
  if (isDefault) {
    await dbc
      .update(userSavedViews)
      .set({ isDefault: true })
      .where(
        and(
          eq(userSavedViews.id, id),
          eq(userSavedViews.organizationId, scope.orgId),
          eq(userSavedViews.userId, userId),
          eq(userSavedViews.pageKey, pageKey),
        ),
      )
  }

  return listSavedViews(scope, userId, pageKey)
}

export async function getDefaultSavedView(
  scope: OrgScope,
  userId: string,
  pageKey: string,
): Promise<SavedView | undefined> {
  const dbc = resolveDbc(scope)
  const rows = await dbc
    .select()
    .from(userSavedViews)
    .where(
      and(
        eq(userSavedViews.organizationId, scope.orgId),
        eq(userSavedViews.userId, userId),
        eq(userSavedViews.pageKey, pageKey),
        eq(userSavedViews.isDefault, true),
      ),
    )
    .limit(1)
  const row = rows[0]

  return row === undefined ? undefined : toSavedView(row)
}

export async function deleteSavedView(
  scope: OrgScope,
  userId: string,
  pageKey: string,
  id: string,
): Promise<SavedView[]> {
  const dbc = resolveDbc(scope)
  await dbc
    .delete(userSavedViews)
    .where(
      and(
        eq(userSavedViews.id, id),
        eq(userSavedViews.organizationId, scope.orgId),
        eq(userSavedViews.userId, userId),
        eq(userSavedViews.pageKey, pageKey),
      ),
    )

  return listSavedViews(scope, userId, pageKey)
}
