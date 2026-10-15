import { deleteClient, getClient, updateClient } from "@/lib/crm/store/clients"
import { loadOrgEnums } from "@/lib/crm/enums/service"
import { route } from "@/app/api/internal/crm/_lib/route"
import { withApiAudit } from "@/app/api/internal/crm/_lib/apiAuth"
import { readJsonObject, notFound, ok } from "@/app/api/internal/crm/_lib/http"
import { parseUpdateClient } from "@/app/api/internal/crm/_lib/parseBody"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export const GET = route<{ orgSlug: string; id: string }>({}, async ({ params, auth }) => {
  const detail = await getClient(auth.scope, params.id)
  if (detail === null) {
    return notFound("Klient nebyl nalezen.")
  }

  return ok(detail)
})

export const PATCH = route<{ orgSlug: string; id: string }>(
  { mutation: true },
  async ({ request, params, auth }) => {
    const enums = await loadOrgEnums(auth.scope.orgId)
    const patch = parseUpdateClient(await readJsonObject(request), enums)

    return ok(await withApiAudit(auth, (scope) => updateClient(scope, params.id, patch)))
  },
)

export const DELETE = route<{ orgSlug: string; id: string }>(
  { mutation: true },
  async ({ params, auth }) => {
    return ok(await withApiAudit(auth, (scope) => deleteClient(scope, params.id)))
  },
)
