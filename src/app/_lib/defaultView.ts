import { redirect } from "next/navigation"
import { normalizeBrowserQuery } from "@/app/_components/browser/savedViews"
import type { OrgContext } from "@/lib/auth/org-context"
import { getDefaultSavedView } from "@/lib/crm/store/user-personalization"
import { orgHref } from "@/lib/nav"

// Applies the user's default saved view for a list page: a bare URL (no search
// params at all) redirects to the stored query, so the Browser renders the default
// view with a truthful URL. Any explicit param, including one the user just
// removed down to (?group=none), suppresses the redirect. Call this at the top of
// a list page RSC before parsing searchParams. `pageKey` is the path under the org
// slug, identical to the key the SavedViewsMenu derives from the pathname.
export async function applyDefaultSavedView(
  ctx: OrgContext,
  orgSlug: string,
  pageKey: string,
  searchParams: Record<string, string | string[] | undefined>,
): Promise<void> {
  if (Object.keys(searchParams).length > 0) {
    return
  }

  const view = await getDefaultSavedView(ctx.scope, ctx.user.id, pageKey)
  if (view === undefined) {
    return
  }

  const query = normalizeBrowserQuery(view.query)
  if (query.length === 0) {
    return
  }

  redirect(`${orgHref(orgSlug, `/${pageKey}`)}?${query}`)
}
