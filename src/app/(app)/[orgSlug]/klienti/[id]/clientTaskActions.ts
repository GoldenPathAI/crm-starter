"use server"

import { revalidatePath } from "next/cache"
import { updateTicketStatus } from "@/lib/crm/store/tickets"
import { requireOrgContext } from "@/lib/auth/org-context"
import { orgHref } from "@/lib/nav"
import { withUiAudit } from "@/app/_lib/auditedAction"
import type { ActionState } from "@/app/_lib/actionState"
import type { TicketStatus } from "@/core/types/crm.types"

export async function setClientTaskStatusAction(
  orgSlug: string,
  input: {
    ticketId: string
    clientId: string
    status: TicketStatus
  },
): Promise<ActionState> {
  const ctx = await requireOrgContext(orgSlug)
  try {
    await withUiAudit(ctx, (scope) => updateTicketStatus(scope, input.ticketId, input.status))
    revalidatePath(orgHref(orgSlug, `/klienti/${input.clientId}`))
    revalidatePath(orgHref(orgSlug, "/ukoly"))
    return {
      status: "success",
      message:
        input.status === "done" ? "Úkol označen jako hotový." : "Úkol vrácen mezi rozpracované.",
    }
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Úkol se nepodařilo aktualizovat.",
    }
  }
}
