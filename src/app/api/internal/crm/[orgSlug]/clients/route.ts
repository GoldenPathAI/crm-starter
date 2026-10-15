import { createClient, listClients } from "@/lib/crm/store/clients"
import { loadOrgEnums } from "@/lib/crm/enums/service"
import { buildClientListQuery } from "@/app/api/internal/crm/_lib/query"
import { route } from "@/app/api/internal/crm/_lib/route"
import { withApiAudit } from "@/app/api/internal/crm/_lib/api-auth"
import { readJsonObject, created, ok } from "@/app/api/internal/crm/_lib/http"
import { parseCreateClient } from "@/app/api/internal/crm/_lib/parse-body"

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
