import { requireInternalToken } from "@/lib/auth/internal-token"
import { createDeal, listDealsByStage } from "@/lib/crm/store/deals"
import { loadOrgEnums } from "@/lib/crm/enums/service"
import { resolveOrgScope } from "@/app/api/internal/crm/_lib/org-scope"
import { readJsonObject, created, errorResponse, ok } from "@/app/api/internal/crm/_lib/http"
import { parseCreateDeal } from "@/app/api/internal/crm/_lib/parse-body"
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

    return ok(await listDealsByStage(scope))
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST(request: NextRequest, context: Context) {
  const unauthorized = requireInternalToken(request)
  if (unauthorized) {
    return unauthorized
  }

  try {
    const { orgSlug } = await context.params
    const scope = await resolveOrgScope(orgSlug)
    const enums = await loadOrgEnums(scope.orgId)
    const body = await readJsonObject(request)

    return created(await createDeal(scope, parseCreateDeal(body, enums)))
  } catch (error) {
    return errorResponse(error)
  }
}
