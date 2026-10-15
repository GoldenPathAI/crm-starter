import { requireInternalToken } from "@/lib/auth/internalToken"
import { reassignActivityClient } from "@/lib/crm/store/activities"
import { resolveOrgScope } from "@/app/api/internal/crm/_lib/orgScope"
import { readJsonObject, errorResponse, ok, asTrimmed, HttpError } from "@/app/api/internal/crm/_lib/http"
import type { RouteContext } from "@/app/api/internal/crm/_lib/http"
import type { NextRequest } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Context = RouteContext<{ orgSlug: string; id: string }>

export async function POST(request: NextRequest, context: Context) {
  const unauthorized = requireInternalToken(request)
  if (unauthorized) {
    return unauthorized
  }

  try {
    const { orgSlug, id } = await context.params
    const scope = await resolveOrgScope(orgSlug)
    const body = await readJsonObject(request)
    const clientId = asTrimmed(body.clientId)
    if (clientId === undefined) {
      throw new HttpError(400, "Pole clientId je povinné.")
    }

    return ok(await reassignActivityClient(scope, id, clientId))
  } catch (error) {
    return errorResponse(error)
  }
}
