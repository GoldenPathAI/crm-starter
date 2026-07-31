import { requireInternalToken } from "@/lib/auth/internal-token"
import { setTicketAssignees } from "@/lib/crm/store/assignees"
import { createTicket, listTickets } from "@/lib/crm/store/tickets"
import { loadOrgEnums } from "@/lib/crm/enums/service"
import { buildTicketListQuery } from "../../_lib/query"
import { listTicketsDue } from "../../_lib/reads"
import { resolveAssigneeUserIds } from "../../_lib/assignees"
import { resolveOrgScope } from "../../_lib/org-scope"
import { badRequest, readJsonObject, created, errorResponse, ok } from "../../_lib/http"
import { parseAssigneeEmails, parseCreateTicket } from "../../_lib/parse-body"
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
    const due = request.nextUrl.searchParams.get("due")?.trim()
    if (due !== undefined && due.length > 0) {
      if (due !== "dnes" && due !== "tyden") {
        return badRequest("Parametr due musí být dnes nebo tyden.")
      }
      return ok(await listTicketsDue(scope.orgId, due))
    }
    const enums = await loadOrgEnums(scope.orgId)
    const query = buildTicketListQuery(request.nextUrl.searchParams, enums)
    return ok(await listTickets(scope, query))
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
    // Resolve assignees before creating so an unknown e-mail 400s without an orphan ticket.
    const assigneeIds = await resolveAssigneeUserIds(scope.orgId, parseAssigneeEmails(body))
    const ticket = await createTicket(scope, parseCreateTicket(body, enums))
    if (assigneeIds !== undefined) {
      await setTicketAssignees(scope, ticket.id, assigneeIds)
    }
    return created(ticket)
  } catch (error) {
    return errorResponse(error)
  }
}
