"use server"

import { requireOrgContext } from "@/lib/auth/orgContext"
import {
  isClientPinned,
  listPinnedClients,
  listRecentItems,
  recordRecentItem,
  togglePinnedClient,
} from "@/lib/crm/store/userPersonalization"
import type { PinnedClient, RecentItem, RecentItemType } from "@/app/_lib/recentItems"
import type { ActionState } from "@/app/_lib/actionState"

export async function loadPalettePersonalizationAction(
  orgSlug: string,
): Promise<{ pins: PinnedClient[]; recents: RecentItem[] }> {
  const ctx = await requireOrgContext(orgSlug)
  const [pins, recents] = await Promise.all([
    listPinnedClients(ctx.scope, ctx.user.id),
    listRecentItems(ctx.scope, ctx.user.id),
  ])

  return { pins, recents }
}

// Fire-and-forget from the client: a single upsert per navigation. Never throws to the
// caller, which ignores the result.
export async function recordRecentItemAction(
  orgSlug: string,
  input: { itemType: RecentItemType; entityId: string; title: string; href: string },
): Promise<void> {
  const ctx = await requireOrgContext(orgSlug)
  await recordRecentItem(ctx.scope, ctx.user.id, input)
}

export async function isClientPinnedAction(
  orgSlug: string,
  clientId: string,
): Promise<{ pinned: boolean }> {
  const ctx = await requireOrgContext(orgSlug)

  return { pinned: await isClientPinned(ctx.scope, ctx.user.id, clientId) }
}

export async function togglePinnedClientAction(
  orgSlug: string,
  input: { clientId: string; href: string },
): Promise<ActionState & { pinned?: boolean }> {
  const ctx = await requireOrgContext(orgSlug)
  try {
    const pinned = await togglePinnedClient(ctx.scope, ctx.user.id, input)

    return { status: "success", message: pinned ? "Připnuto" : "Odepnuto", pinned }
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Připnutí se nepodařilo změnit.",
    }
  }
}
