import { deletePerson, getPerson, setPrimaryPerson, updatePerson } from "@/lib/crm/store/people"
import { loadOrgEnums } from "@/lib/crm/enums/service"
import { route } from "@/app/api/internal/crm/_lib/route"
import { withApiAudit } from "@/app/api/internal/crm/_lib/api-auth"
import { badRequest, ok, readJsonObject } from "@/app/api/internal/crm/_lib/http"
import { hasPersonPatch, parseUpdatePerson, wantsPrimary } from "@/app/api/internal/crm/_lib/parse-body"
import type { Person } from "@/core/types/crm.types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Params = { orgSlug: string; id: string }

export const GET = route<Params>({}, async ({ params, auth }) =>
  ok(await getPerson(auth.scope, params.id)),
)

export const PATCH = route<Params>({ mutation: true }, async ({ request, params, auth }) => {
  const body = await readJsonObject(request)
  const enums = await loadOrgEnums(auth.scope.orgId)
  const patch = parseUpdatePerson(body, enums)
  const promote = wantsPrimary(body)
  if (!hasPersonPatch(patch) && !promote) {
    return badRequest("Žádná pole k aktualizaci.")
  }

  // Primary is set through its own store mutation to keep the one-primary invariant.
  const person = await withApiAudit(auth, async (scope) => {
    let updated: Person | undefined
    if (hasPersonPatch(patch)) {
      updated = await updatePerson(scope, params.id, patch)
    }

    if (promote) {
      updated = await setPrimaryPerson(scope, params.id)
    }

    return updated
  })

  return ok(person)
})

export const DELETE = route<Params>({ mutation: true }, async ({ params, auth }) => {
  await withApiAudit(auth, (scope) => deletePerson(scope, params.id))

  return ok({ ok: true })
})
