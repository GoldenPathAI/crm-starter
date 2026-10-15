import { requireInternalToken } from "@/lib/auth/internal-token"
import { updateTicketStatus } from "@/lib/crm/store/tickets"
import { loadOrgEnums } from "@/lib/crm/enums/service"
import { resolveOrgScope } from "@/app/api/internal/crm/_lib/org-scope"
import { readJsonObject, errorResponse, ok } from "@/app/api/internal/crm/_lib/http"
import { parseTicketStatus } from "@/app/api/internal/crm/_lib/parse-body"
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
    const enums = await loadOrgEnums(scope.orgId)
    const body = await readJsonObject(request)

    return ok(await updateTicketStatus(scope, id, parseTicketStatus(body, enums)))
  } catch (error) {
    return errorResponse(error)
  }
}
