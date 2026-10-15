import { requireInternalToken } from "@/lib/auth/internal-token"
import { searchEntities } from "@/lib/crm/store/search"
import { resolveOrgScope } from "@/app/api/internal/crm/_lib/org-scope"
import { badRequest, errorResponse, ok } from "@/app/api/internal/crm/_lib/http"
import type { RouteContext } from "@/app/api/internal/crm/_lib/http"
import type { NextRequest } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Context = RouteContext<{ orgSlug: string }>

// Global command-palette search across clients, deals, projects and tickets.
// Backed by the same store the in-app search bar uses.
export async function GET(request: NextRequest, context: Context) {
  const unauthorized = requireInternalToken(request)
  if (unauthorized) {
    return unauthorized
  }

  try {
    const { orgSlug } = await context.params
    const scope = await resolveOrgScope(orgSlug)
    const q = request.nextUrl.searchParams.get("q")?.trim()
    if (q === undefined || q.length < 2) {
      return badRequest("Zadej hledaný výraz (parametr q, alespoň 2 znaky).")
    }

    const items = await searchEntities(scope, q)

    return ok({ items, total: items.length })
  } catch (error) {
    return errorResponse(error)
  }
}
