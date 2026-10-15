import { createPerson, getPeopleByClientId, listRapportPeople } from "@/lib/crm/store/people"
import { loadOrgEnums } from "@/lib/crm/enums/service"
import { route } from "../../_lib/route"
import { withApiAudit } from "../../_lib/api-auth"
import { created, ok, readJsonObject } from "../../_lib/http"
import { buildRapportPeopleQuery } from "../../_lib/query"
import { parseCreatePerson } from "../../_lib/parse-body"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// With `clientId` this is that client's contact list; without it, the whole org's
// raport: every person plus their rapport counters.
export const GET = route<{ orgSlug: string }>({}, async ({ request, auth }) => {
  const clientId = request.nextUrl.searchParams.get("clientId")?.trim()
  if (clientId !== undefined && clientId.length > 0) {
    return ok(await getPeopleByClientId(auth.scope, clientId))
  }

  const enums = await loadOrgEnums(auth.scope.orgId)
  const query = buildRapportPeopleQuery(request.nextUrl.searchParams, enums)

  return ok(await listRapportPeople(auth.scope, query))
})

export const POST = route<{ orgSlug: string }>({ mutation: true }, async ({ request, auth }) => {
  const enums = await loadOrgEnums(auth.scope.orgId)
  const input = parseCreatePerson(await readJsonObject(request), enums)

  return created(await withApiAudit(auth, (scope) => createPerson(scope, input)))
})
