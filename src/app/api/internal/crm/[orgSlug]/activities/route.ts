import { requireInternalToken } from "@/lib/auth/internal-token"
import { addActivity } from "@/lib/crm/store/activities"
import { loadOrgEnums } from "@/lib/crm/enums/service"
import { resolveOrgScope } from "../../_lib/org-scope"
import { badRequest, readJsonObject, created, errorResponse, ok } from "../../_lib/http"
import { parseAddActivity } from "../../_lib/parse-body"
import { listActivitiesByClient } from "../../_lib/reads"
import type { RouteContext } from "../../_lib/http"
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
    const clientId = request.nextUrl.searchParams.get("clientId")?.trim()
    if (clientId === undefined || clientId.length === 0) {
      return badRequest("Chybí parametr clientId.")
    }

    return ok(await listActivitiesByClient(scope.orgId, clientId))
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

    return created(await addActivity(scope, parseAddActivity(body, enums)))
  } catch (error) {
    return errorResponse(error)
  }
}
