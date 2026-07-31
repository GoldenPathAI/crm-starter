import { requireInternalToken } from "@/lib/auth/internal-token"
import { deleteProject, getProject, updateProject } from "@/lib/crm/store/projects"
import { loadOrgEnums } from "@/lib/crm/enums/service"
import { resolveOrgScope } from "../../../_lib/org-scope"
import { readJsonObject, errorResponse, notFound, ok } from "../../../_lib/http"
import { parseUpdateProject } from "../../../_lib/parse-body"
import type { RouteContext } from "../../../_lib/http"
import type { NextRequest } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Context = RouteContext<{ orgSlug: string; id: string }>

export async function GET(request: NextRequest, context: Context) {
  const unauthorized = requireInternalToken(request)
  if (unauthorized) {
    return unauthorized
  }
  try {
    const { orgSlug, id } = await context.params
    const scope = await resolveOrgScope(orgSlug)
    const detail = await getProject(scope, id)
    if (detail === null) {
      return notFound("Projekt nebyl nalezen.")
    }
    return ok(detail)
  } catch (error) {
    return errorResponse(error)
  }
}

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
    const existing = await getProject(scope, id)
    if (existing === null) {
      return notFound("Projekt nebyl nalezen.")
    }
    return ok(await updateProject(scope, id, parseUpdateProject(existing.project, body, enums)))
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
    await deleteProject(scope, id)
    return ok({ ok: true })
  } catch (error) {
    return errorResponse(error)
  }
}
