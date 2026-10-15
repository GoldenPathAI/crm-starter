import { requireInternalToken } from "@/lib/auth/internalToken"
import { getDashboardData } from "@/lib/crm/store/dashboard"
import { resolveOrgScope } from "@/app/api/internal/crm/_lib/orgScope"
import { errorResponse, ok } from "@/app/api/internal/crm/_lib/http"
import type { RouteContext } from "@/app/api/internal/crm/_lib/http"
import type { NextRequest } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Context = RouteContext<{ orgSlug: string }>

export async function GET(request: NextRequest, context: Context) {
  const unauthorized = requireInternalToken(request)
  if (unauthorized) {
    return unauthorized
  }

  try {
    const { orgSlug } = await context.params
    const scope = await resolveOrgScope(orgSlug)

    return ok(await getDashboardData(scope))
  } catch (error) {
    return errorResponse(error)
  }
}
