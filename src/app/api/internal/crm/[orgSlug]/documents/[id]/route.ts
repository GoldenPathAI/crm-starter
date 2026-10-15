import { requireInternalToken } from "@/lib/auth/internalToken"
import { deleteDocument, updateDocument } from "@/lib/crm/store/documents"
import { loadOrgEnums } from "@/lib/crm/enums/service"
import { getDocumentById } from "@/app/api/internal/crm/_lib/reads"
import { resolveOrgScope } from "@/app/api/internal/crm/_lib/orgScope"
import { readJsonObject, errorResponse, notFound, ok } from "@/app/api/internal/crm/_lib/http"
import { parseUpdateDocument } from "@/app/api/internal/crm/_lib/parseBody"
import type { RouteContext } from "@/app/api/internal/crm/_lib/http"
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
    const existing = await getDocumentById(scope.orgId, id)
    if (existing === null) {
      return notFound("Dokument nebyl nalezen.")
    }

    return ok(await updateDocument(scope, id, parseUpdateDocument(existing, body, enums)))
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
    await deleteDocument(scope, id)

    return ok({ ok: true })
  } catch (error) {
    return errorResponse(error)
  }
}
