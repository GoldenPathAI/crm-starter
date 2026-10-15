"use server"

import { revalidatePath } from "next/cache"
import { updateTicketStatus } from "@/lib/crm/mutations"
import { deleteTicket, patchTicket, updateTicket } from "@/lib/crm/store/tickets"
import { setTicketAssignees } from "@/lib/crm/store/assignees"
import { getBySemantic } from "@/lib/crm/enums/service"
import { requireOrgContext } from "@/lib/auth/orgContext"
import { orgHref } from "@/lib/nav"
import { withUiAudit } from "@/app/_lib/auditedAction"
import type { ActionState } from "@/app/_lib/actionState"

const optionalText = (value: string): string | undefined => {
  const trimmed = value.trim()

  return trimmed.length > 0 ? trimmed : undefined
}

const BULK_LIMIT = 200

const validateBulkIds = (ids: string[]): string | null => {
  if (ids.length === 0) {
    return "Nejsou vybrané žádné úkoly."
  }

  if (ids.length > BULK_LIMIT) {
    return `Najednou lze upravit nejvýše ${BULK_LIMIT} úkolů.`
  }

  return null
}

// Czech pluralization: 1 úkol, 2-4 úkoly, 5+ úkolů; `forms` carries the matching
// participle for each bucket.
const ticketBulkMessage = (count: number, forms: readonly [string, string, string]): string =>
  count === 1
    ? `1 úkol ${forms[0]}`
    : count <= 4
      ? `${count} úkoly ${forms[1]}`
      : `${count} úkolů ${forms[2]}`

export interface QuickTicketEditPayload {
  ticketId: string
  title: string
  description: string
  priority: string
  status: string
  dueAt: string
  labels: string[]
}

export async function quickEditTicketAction(
  orgSlug: string,
  input: QuickTicketEditPayload,
): Promise<ActionState> {
  const ctx = await requireOrgContext(orgSlug)
  if (input.title.trim().length === 0) {
    return { status: "error", message: "Vyplňte název úkolu." }
  }

  try {
    await withUiAudit(ctx, (scope) =>
      updateTicket(scope, input.ticketId, {
        title: input.title.trim(),
        description: optionalText(input.description),
        priority: input.priority,
        status: input.status,
        dueAt: optionalText(input.dueAt),
        labels: input.labels,
      }),
    )
    revalidatePath(orgHref(orgSlug, "/ukoly"))
    revalidatePath(orgHref(orgSlug, "/projekty"))

    return { status: "success", message: "Úkol byl upraven." }
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Úkol se nepodařilo upravit.",
    }
  }
}

export async function quickSetTicketStatusAction(
  orgSlug: string,
  input: {
    ticketId: string
    status: string
  },
): Promise<ActionState> {
  const ctx = await requireOrgContext(orgSlug)
  try {
    await withUiAudit(ctx, (scope) => updateTicketStatus(scope, input.ticketId, input.status))
    revalidatePath(orgHref(orgSlug, "/ukoly"))
    revalidatePath(orgHref(orgSlug, "/projekty"))
    const doneOption = await getBySemantic(ctx.scope.orgId, "ticket_status", "done")

    return {
      status: "success",
      message:
        input.status === doneOption.value
          ? "Úkol označen jako hotový."
          : "Úkol vrácen mezi rozpracované.",
    }
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Úkol se nepodařilo aktualizovat.",
    }
  }
}

export async function bulkCompleteTicketsAction(
  orgSlug: string,
  ticketIds: string[],
): Promise<ActionState> {
  const ctx = await requireOrgContext(orgSlug)
  const invalid = validateBulkIds(ticketIds)
  if (invalid !== null) {
    return { status: "error", message: invalid }
  }

  try {
    const doneOption = await getBySemantic(ctx.scope.orgId, "ticket_status", "done")
    const requestId = await withUiAudit(ctx, async (scope, reqId) => {
      for (const ticketId of ticketIds) {
        await updateTicketStatus(scope, ticketId, doneOption.value)
      }

      return reqId
    })
    revalidatePath(orgHref(orgSlug, "/ukoly"))
    revalidatePath(orgHref(orgSlug, "/projekty"))

    return {
      status: "success",
      message: ticketBulkMessage(ticketIds.length, ["dokončen", "dokončeny", "dokončeno"]),
      requestId,
    }
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Úkoly se nepodařilo dokončit.",
    }
  }
}

export async function bulkSetTicketPriorityAction(
  orgSlug: string,
  ticketIds: string[],
  priority: string,
): Promise<ActionState> {
  const ctx = await requireOrgContext(orgSlug)
  const invalid = validateBulkIds(ticketIds)
  if (invalid !== null) {
    return { status: "error", message: invalid }
  }

  if (priority.length === 0) {
    return { status: "error", message: "Vyberte prioritu." }
  }

  try {
    const requestId = await withUiAudit(ctx, async (scope, reqId) => {
      for (const ticketId of ticketIds) {
        await patchTicket(scope, ticketId, { priority })
      }

      return reqId
    })
    revalidatePath(orgHref(orgSlug, "/ukoly"))
    revalidatePath(orgHref(orgSlug, "/projekty"))

    return {
      status: "success",
      message: ticketBulkMessage(ticketIds.length, ["upraven", "upraveny", "upraveno"]),
      requestId,
    }
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Prioritu se nepodařilo změnit.",
    }
  }
}

export async function bulkAssignTicketsAction(
  orgSlug: string,
  ticketIds: string[],
  userIds: string[],
): Promise<ActionState> {
  const ctx = await requireOrgContext(orgSlug)
  const invalid = validateBulkIds(ticketIds)
  if (invalid !== null) {
    return { status: "error", message: invalid }
  }

  if (userIds.length === 0) {
    return { status: "error", message: "Vyberte alespoň jednoho člena." }
  }

  try {
    const requestId = await withUiAudit(ctx, async (scope, reqId) => {
      for (const ticketId of ticketIds) {
        await setTicketAssignees(scope, ticketId, userIds)
      }

      return reqId
    })
    revalidatePath(orgHref(orgSlug, "/ukoly"))
    revalidatePath(orgHref(orgSlug, "/projekty"))

    return {
      status: "success",
      message: ticketBulkMessage(ticketIds.length, ["přiřazen", "přiřazeny", "přiřazeno"]),
      requestId,
    }
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Úkoly se nepodařilo přiřadit.",
    }
  }
}

export async function bulkDeleteTicketsAction(
  orgSlug: string,
  ticketIds: string[],
): Promise<ActionState> {
  const ctx = await requireOrgContext(orgSlug)
  const invalid = validateBulkIds(ticketIds)
  if (invalid !== null) {
    return { status: "error", message: invalid }
  }

  try {
    const requestId = await withUiAudit(ctx, async (scope, reqId) => {
      for (const ticketId of ticketIds) {
        await deleteTicket(scope, ticketId)
      }

      return reqId
    })
    revalidatePath(orgHref(orgSlug, "/ukoly"))
    revalidatePath(orgHref(orgSlug, "/projekty"))

    return {
      status: "success",
      message: ticketBulkMessage(ticketIds.length, ["smazán", "smazány", "smazáno"]),
      requestId,
    }
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Úkoly se nepodařilo smazat.",
    }
  }
}
