import { createClient, listClients } from "@/lib/crm/store/clients"
import { loadOrgEnums } from "@/lib/crm/enums/service"
import { buildClientListQuery } from "../../_lib/query"
import { route } from "../../_lib/route"
import { withApiAudit } from "../../_lib/api-auth"
import { readJsonObject, created, ok } from "../../_lib/http"
import { parseCreateClient } from "../../_lib/parse-body"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export const GET = route<{ orgSlug: string }>({}, async ({ request, auth }) => {
  const enums = await loadOrgEnums(auth.scope.orgId)
  const query = buildClientListQuery(request.nextUrl.searchParams, enums)
  return ok(await listClients(auth.scope, query))
})

export const POST = route<{ orgSlug: string }>({ mutation: true }, async ({ request, auth }) => {
  const enums = await loadOrgEnums(auth.scope.orgId)
  const input = parseCreateClient(await readJsonObject(request), enums)
  return created(await withApiAudit(auth, (scope) => createClient(scope, input)))
})
