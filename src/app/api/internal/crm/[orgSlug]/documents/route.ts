import { requireInternalToken } from "@/lib/auth/internalToken"
import { createDocument, getAllDocuments, getDocumentsByClientId } from "@/lib/crm/store/documents"
import { loadOrgEnums } from "@/lib/crm/enums/service"
import { resolveOrgScope } from "@/app/api/internal/crm/_lib/orgScope"
import { readJsonObject, created, errorResponse, ok } from "@/app/api/internal/crm/_lib/http"
import { parseCreateDocument } from "@/app/api/internal/crm/_lib/parseBody"
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
    const clientId = request.nextUrl.searchParams.get("clientId")?.trim()
    const documents =
      clientId !== undefined && clientId.length > 0
        ? await getDocumentsByClientId(scope, clientId)
        : await getAllDocuments(scope)

    return ok(documents)
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

    return created(await createDocument(scope, parseCreateDocument(body, enums)))
  } catch (error) {
    return errorResponse(error)
  }
}
