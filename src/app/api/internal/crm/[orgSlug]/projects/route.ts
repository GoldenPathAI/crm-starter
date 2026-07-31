import { requireInternalToken } from "@/lib/auth/internal-token"
import { createProject, listProjects } from "@/lib/crm/store/projects"
import { loadOrgEnums } from "@/lib/crm/enums/service"
import { resolveOrgScope } from "../../_lib/org-scope"
import { readJsonObject, created, errorResponse, ok } from "../../_lib/http"
import { parseCreateProject } from "../../_lib/parse-body"
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
    return ok(await listProjects(scope))
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
    return created(await createProject(scope, parseCreateProject(body, enums)))
  } catch (error) {
    return errorResponse(error)
  }
}
