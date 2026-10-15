"use server"

import { revalidatePath } from "next/cache"
import { deleteClient, updateClient } from "@/lib/crm/store/clients"
import { requireOrgContext } from "@/lib/auth/orgContext"
import { orgHref } from "@/lib/nav"
import { withUiAudit } from "@/app/_lib/auditedAction"
import type { ActionState } from "@/app/_lib/actionState"

const BULK_LIMIT = 200

const validateBulkIds = (ids: string[]): string | null => {
  if (ids.length === 0) {
    return "Nejsou vybraní žádní klienti."
  }

  if (ids.length > BULK_LIMIT) {
    return `Najednou lze upravit nejvýše ${BULK_LIMIT} klientů.`
  }

  return null
}

// Czech pluralization: 1 klient, 2-4 klienti, 5+ klientů; `forms` carries the
// matching participle for each bucket.
const clientBulkMessage = (count: number, forms: readonly [string, string, string]): string =>
  count === 1
    ? `1 klient ${forms[0]}`
    : count <= 4
      ? `${count} klienti ${forms[1]}`
      : `${count} klientů ${forms[2]}`

export async function bulkSetClientStatusAction(
  orgSlug: string,
  clientIds: string[],
  status: string,
): Promise<ActionState> {
  const ctx = await requireOrgContext(orgSlug)
  const invalid = validateBulkIds(clientIds)
  if (invalid !== null) {
    return { status: "error", message: invalid }
  }

  if (status.length === 0) {
    return { status: "error", message: "Vyberte status." }
  }

  try {
    const requestId = await withUiAudit(ctx, async (scope, reqId) => {
      for (const clientId of clientIds) {
        await updateClient(scope, clientId, { status })
      }

      return reqId
    })
    revalidatePath(orgHref(orgSlug, "/klienti"))

    return {
      status: "success",
      message: clientBulkMessage(clientIds.length, ["upraven", "upraveni", "upraveno"]),
      requestId,
    }
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Status se nepodařilo změnit.",
    }
  }
}

// Deletes what it can and reports the rest: deleteClient refuses a client with
// related records by throwing before any write, so a per-item catch keeps the
// shared transaction usable and one batch stays fully undoable.
export async function bulkDeleteClientsAction(
  orgSlug: string,
  clientIds: string[],
): Promise<ActionState> {
  const ctx = await requireOrgContext(orgSlug)
  const invalid = validateBulkIds(clientIds)
  if (invalid !== null) {
    return { status: "error", message: invalid }
  }

  try {
    const outcome = await withUiAudit(ctx, async (scope, reqId) => {
      let deleted = 0
      let failed = 0
      for (const clientId of clientIds) {
        try {
          await deleteClient(scope, clientId)
          deleted += 1
        } catch {
          failed += 1
        }
      }

      return { requestId: reqId, deleted, failed }
    })
    if (outcome.deleted === 0) {
      return {
        status: "error",
        message:
          outcome.failed === 1
            ? "Klienta nelze smazat (má navázané záznamy)."
            : "Vybrané klienty nelze smazat (mají navázané záznamy).",
      }
    }

    revalidatePath(orgHref(orgSlug, "/klienti"))
    const deletedPart = clientBulkMessage(outcome.deleted, ["smazán", "smazáni", "smazáno"])
    const failedPart =
      outcome.failed === 0
        ? ""
        : outcome.failed === 1
          ? ", 1 nelze smazat (má navázané záznamy)"
          : `, ${outcome.failed} nelze smazat (mají navázané záznamy)`

    return {
      status: "success",
      message: `${deletedPart}${failedPart}`,
      requestId: outcome.requestId,
    }
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Klienty se nepodařilo smazat.",
    }
  }
}
