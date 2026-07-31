"use server"

import { revalidatePath } from "next/cache"
import { requireOrgContext } from "@/lib/auth/org-context"
import { orgHref } from "@/lib/nav"
import { withUiAudit } from "@/app/_lib/auditedAction"
import { updateTicketStatus } from "@/lib/crm/mutations"
import { getTicketAssignees, setTicketAssignees } from "@/lib/crm/store/assignees"
import { getBySemantic } from "@/lib/crm/enums/service"
import { searchEntities, type SearchResult } from "@/lib/crm/store/search"
import type { ActionState } from "@/app/_lib/actionState"

export async function searchCommandAction(
  orgSlug: string,
  query: string,
): Promise<{ results: SearchResult[] }> {
  const ctx = await requireOrgContext(orgSlug)
  return { results: await searchEntities(ctx.scope, query) }
}

export async function completeTicketCommandAction(
  orgSlug: string,
  ticketId: string,
): Promise<ActionState> {
  const ctx = await requireOrgContext(orgSlug)
  try {
    const doneOption = await getBySemantic(ctx.scope.orgId, "ticket_status", "done")
    const requestId = await withUiAudit(ctx, async (scope, reqId) => {
      await updateTicketStatus(scope, ticketId, doneOption.value)
      return reqId
    })
    revalidatePath(orgHref(orgSlug, "/ukoly"))
    revalidatePath(orgHref(orgSlug, "/projekty"))
    return { status: "success", message: "Úkol označen jako hotový.", requestId }
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Úkol se nepodařilo dokončit.",
    }
  }
}

export async function assignSelfToTicketCommandAction(
  orgSlug: string,
  ticketId: string,
): Promise<ActionState> {
  const ctx = await requireOrgContext(orgSlug)
  try {
    const current = await getTicketAssignees(ctx.scope, [ticketId])
    const currentIds = (current[ticketId] ?? []).map((member) => member.userId)
    if (currentIds.includes(ctx.user.id)) {
      return { status: "success", message: "Přiřazeno" }
    }
    const requestId = await withUiAudit(ctx, async (scope, reqId) => {
      await setTicketAssignees(scope, ticketId, [...currentIds, ctx.user.id])
      return reqId
    })
    revalidatePath(orgHref(orgSlug, "/ukoly"))
    revalidatePath(orgHref(orgSlug, "/projekty"))
    return { status: "success", message: "Přiřazeno", requestId }
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Úkol se nepodařilo přiřadit.",
    }
  }
}
