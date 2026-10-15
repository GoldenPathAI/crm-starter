import { requireInternalToken } from "@/lib/auth/internal-token"
import { deleteTicket, updateTicket } from "@/lib/crm/store/tickets"
import { loadOrgEnums } from "@/lib/crm/enums/service"
import { getTicketById } from "../../../_lib/reads"
import { resolveOrgScope } from "../../../_lib/org-scope"
import { readJsonObject, errorResponse, notFound, ok } from "../../../_lib/http"
import { parseUpdateTicket } from "../../../_lib/parse-body"
import type { RouteContext } from "../../../_lib/http"
import type { NextRequest } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Context = RouteContext<{ orgSlug: string; id: string }>

export async function PATCH(request: NextRequest, context: Context) {
  const unauthorized = requireInternalToken(request)
  if (unauthorized) {
    return unauthorized
  }

  try {
    const { orgSlug, id } = await context.params
    const scope = await resolveOrgScope(orgSlug)
    const enums = await loadOrgEnums(scope.orgId)
    const body = await readJsonObject(request)
    const existing = await getTicketById(scope.orgId, id)
    if (existing === null) {
      return notFound("Úkol nebyl nalezen.")
    }

    return ok(await updateTicket(scope, id, parseUpdateTicket(existing, body, enums)))
  } catch (error) {
    return errorResponse(error)
  }
}

export async function DELETE(request: NextRequest, context: Context) {
  const unauthorized = requireInternalToken(request)
  if (unauthorized) {
    return unauthorized
  }

  try {
    const { orgSlug, id } = await context.params
    const scope = await resolveOrgScope(orgSlug)
    await deleteTicket(scope, id)

    return ok({ ok: true })
  } catch (error) {
    return errorResponse(error)
  }
}
