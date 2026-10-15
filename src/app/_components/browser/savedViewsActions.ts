"use server"

import { requireOrgContext } from "@/lib/auth/orgContext"
import {
  deleteSavedView,
  listSavedViews,
  saveSavedView,
  setDefaultSavedView,
} from "@/lib/crm/store/userPersonalization"
import type { SavedView } from "@/app/_components/browser/savedViews"

export async function listSavedViewsAction(
  orgSlug: string,
  pageKey: string,
): Promise<{ views: SavedView[] }> {
  const ctx = await requireOrgContext(orgSlug)

  return { views: await listSavedViews(ctx.scope, ctx.user.id, pageKey) }
}

export async function saveSavedViewAction(
  orgSlug: string,
  pageKey: string,
  name: string,
  query: string,
): Promise<{ views: SavedView[] }> {
  const ctx = await requireOrgContext(orgSlug)

  return { views: await saveSavedView(ctx.scope, ctx.user.id, pageKey, name, query) }
}

export async function setDefaultSavedViewAction(
  orgSlug: string,
  pageKey: string,
  id: string,
  isDefault: boolean,
): Promise<{ views: SavedView[] }> {
  const ctx = await requireOrgContext(orgSlug)

  return { views: await setDefaultSavedView(ctx.scope, ctx.user.id, pageKey, id, isDefault) }
}

export async function deleteSavedViewAction(
  orgSlug: string,
  pageKey: string,
  id: string,
): Promise<{ views: SavedView[] }> {
  const ctx = await requireOrgContext(orgSlug)

  return { views: await deleteSavedView(ctx.scope, ctx.user.id, pageKey, id) }
}
