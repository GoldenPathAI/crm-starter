"use server"

import { revalidatePath } from "next/cache"
import { requireOrgContext } from "@/lib/auth/org-context"
import { orgHref } from "@/lib/nav"
import { listAuditBatch } from "@/lib/crm/audit/queries"
import { undoBatch } from "@/lib/crm/audit/undo"
import type { ActionState } from "@/app/_lib/actionState"

// The main org surfaces whose caches an undo can invalidate. A reverted batch may
// have touched any of them, so all are refreshed.
const UNDO_SURFACES: readonly string[] = [
  "/prehled",
  "/klienti",
  "/pipeline",
  "/projekty",
  "/ukoly",
]

// Reverts one audited UI batch. The batch id (requestId) is looked up scoped to the
// caller's org, so a request id from another workspace resolves to an empty batch and
// is refused before undoBatch runs. undoBatch itself throws a Czech conflict message
// when the rows diverged; that message is surfaced verbatim.
export async function undoUiAction(orgSlug: string, requestId: string): Promise<ActionState> {
  const ctx = await requireOrgContext(orgSlug)
  if (requestId.length === 0) {
    return { status: "error", message: "Chybí identifikátor akce." }
  }

  try {
    const entries = await listAuditBatch(ctx.scope.orgId, requestId)
    if (entries.length === 0) {
      return { status: "error", message: "Tuto akci už nelze vrátit zpět." }
    }

    await undoBatch(ctx.scope.orgId, requestId, { actorUserId: ctx.user.id })
    for (const surface of UNDO_SURFACES) {
      revalidatePath(orgHref(orgSlug, surface))
    }

    return { status: "success", message: "Akce byla vrácena zpět." }
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Akci se nepodařilo vrátit zpět.",
    }
  }
}
