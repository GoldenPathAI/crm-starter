import { deleteRapportEntry } from "@/lib/crm/store/rapport"
import { route } from "../../../_lib/route"
import { withApiAudit } from "../../../_lib/api-auth"
import { ok } from "../../../_lib/http"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export const DELETE = route<{ orgSlug: string; id: string }>(
  { mutation: true },
  async ({ params, auth }) => {
    await withApiAudit(auth, (scope) => deleteRapportEntry(scope, params.id))
    return ok({ ok: true })
  },
)
