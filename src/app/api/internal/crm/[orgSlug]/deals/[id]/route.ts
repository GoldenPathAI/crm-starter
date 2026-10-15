import { requireInternalToken } from "@/lib/auth/internal-token"
import { deleteDeal, updateDeal } from "@/lib/crm/store/deals"
import { resolveOrgScope } from "../../../_lib/org-scope"
import { readJsonObject, errorResponse, ok } from "../../../_lib/http"
import { parseUpdateDeal } from "../../../_lib/parse-body"
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
    const body = await readJsonObject(request)

    return ok(await updateDeal(scope, parseUpdateDeal(id, body)))
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
    await deleteDeal(scope, id)

    return ok({ ok: true })
  } catch (error) {
    return errorResponse(error)
  }
}
