import { createRapportEntry, listRapportEntries } from "@/lib/crm/store/rapport"
import { loadOrgEnums } from "@/lib/crm/enums/service"
import { route } from "@/app/api/internal/crm/_lib/route"
import { withApiAudit } from "@/app/api/internal/crm/_lib/api-auth"
import { created, ok, readJsonObject } from "@/app/api/internal/crm/_lib/http"
import { parseCreateRapportEntry } from "@/app/api/internal/crm/_lib/parse-body"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Params = { orgSlug: string; id: string }

export const GET = route<Params>({}, async ({ params, auth }) =>
  ok(await listRapportEntries(auth.scope, params.id)),
)

export const POST = route<Params>({ mutation: true }, async ({ request, params, auth }) => {
  const enums = await loadOrgEnums(auth.scope.orgId)
  const input = parseCreateRapportEntry(params.id, await readJsonObject(request), enums)

  return created(await withApiAudit(auth, (scope) => createRapportEntry(scope, input)))
})
