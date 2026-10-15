import { deleteRapportEntry } from "@/lib/crm/store/rapport"
import { route } from "@/app/api/internal/crm/_lib/route"
import { withApiAudit } from "@/app/api/internal/crm/_lib/apiAuth"
import { ok } from "@/app/api/internal/crm/_lib/http"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export const DELETE = route<{ orgSlug: string; id: string }>(
  { mutation: true },
  async ({ params, auth }) => {
    await withApiAudit(auth, (scope) => deleteRapportEntry(scope, params.id))

    return ok({ ok: true })
  },
)
