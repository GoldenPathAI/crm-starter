"use server"

import { revalidatePath } from "next/cache"
import { createDeal, deleteDeal, moveDealStage, reorderDeal, updateDeal } from "@/lib/crm/store/deals"
import { createTicket, listTicketsByDeal } from "@/lib/crm/store/tickets"
import { setDealAssignees } from "@/lib/crm/store/assignees"
import { getBySemantic, listOptions, loadOrgEnums } from "@/lib/crm/enums/service"
import { requireOrgContext } from "@/lib/auth/orgContext"
import { listAuditForEntity } from "@/lib/crm/audit/queries"
import { buildHistoryItems, type HistoryItem } from "@/app/_components/HistoryCard"
import { createServerLogger, logActionableError } from "@/lib/logger"
import { withUiAudit } from "@/app/_lib/auditedAction"
import type { ActionState } from "@/app/_lib/actionState"
import type { EnumOption } from "@/core/types/crm.types"
import type { TaskSubtask } from "@/app/_components/task-detail/types"
import type { DealFormValues } from "./_lib/types"

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

const findStageOption = async (orgId: string, stage: string): Promise<EnumOption | undefined> =>
  (await listOptions(orgId, "deal_stage")).find((option) => option.value === stage)

// Resolves a ticket enum default by stable semantic, falling back to the first option so
// a renamed ciselnik still yields a valid value for a freshly added deal task.
const pickTicketValue = (options: EnumOption[], semantic: string): string => {
  const chosen = options.find((option) => option.semantic === semantic) ?? options[0]
  if (chosen === undefined) {
    throw new Error("Číselník úkolů neobsahuje žádnou hodnotu.")
  }

  return chosen.value
}

interface NormalizedFields {
  clientId: string
  title: string
  valueCzk: number
  probability: number | null
  expectedClose: string | null
  nextStep: string | null
  offerUrl: string | null
}

const isHttpUrl = (value: string): boolean => {
  try {
    const protocol = new URL(value).protocol

    return protocol === "http:" || protocol === "https:"
  } catch {
    return false
  }
}

// Returns either the cleaned fields or a user-facing validation message.
const normalizeFields = (values: DealFormValues): NormalizedFields | string => {
  const clientId = values.clientId.trim()
  if (clientId.length === 0) {
    return "Vyberte klienta."
  }

  const title = values.title.trim()
  if (title.length === 0) {
    return "Vyplňte název dealu."
  }

  if (!Number.isFinite(values.valueCzk) || values.valueCzk < 0) {
    return "Zadejte hodnotu dealu."
  }

  const valueCzk = Math.round(values.valueCzk)

  let probability: number | null = null
  if (values.probability !== null) {
    if (!Number.isFinite(values.probability) || values.probability < 0 || values.probability > 100) {
      return "Pravděpodobnost musí být mezi 0 a 100."
    }

    probability = Math.round(values.probability)
  }

  let expectedClose: string | null = null
  if (values.expectedClose !== null) {
    const trimmed = values.expectedClose.trim()
    if (trimmed.length > 0) {
      if (!ISO_DATE.test(trimmed)) {
        return "Neplatné datum očekávaného uzavření."
      }

      expectedClose = trimmed
    }
  }

  const nextStepRaw = values.nextStep?.trim() ?? ""
  const nextStep = nextStepRaw.length > 0 ? nextStepRaw : null

  let offerUrl: string | null = null
  if (values.offerUrl !== null) {
    const trimmed = values.offerUrl.trim()
    if (trimmed.length > 0) {
      if (!isHttpUrl(trimmed)) {
        return "Odkaz na nabídku musí být platná URL."
      }

      offerUrl = trimmed
    }
  }

  return { clientId, title, valueCzk, probability, expectedClose, nextStep, offerUrl }
}

export async function createDealAction(
  orgSlug: string,
  values: DealFormValues,
  stage: string,
  assigneeIds: string[] = [],
): Promise<ActionState> {
  const logger = createServerLogger({
    layer: "action",
    module: "PipelineActions",
    operation: "createDealAction",
  })
  const ctx = await requireOrgContext(orgSlug)
  try {
    const stageOption = await findStageOption(ctx.scope.orgId, stage)
    if (stageOption === undefined) {
      return { status: "error", message: "Neznámá fáze pipeline." }
    }

    const fields = normalizeFields(values)
    if (typeof fields === "string") {
      return { status: "error", message: fields }
    }

    await withUiAudit(ctx, async (scope) => {
      const deal = await createDeal(scope, {
        clientId: fields.clientId,
        title: fields.title,
        stage,
        valueCzk: fields.valueCzk,
        probability: fields.probability ?? undefined,
        expectedClose: fields.expectedClose ?? undefined,
        nextStep: fields.nextStep ?? undefined,
      })
      if (assigneeIds.length > 0) {
        await setDealAssignees(scope, deal.id, assigneeIds)
      }
    })
    revalidatePath(`/${orgSlug}/pipeline`)

    return { status: "success", message: "Deal byl vytvořen." }
  } catch (error) {
    logActionableError(
      logger,
      error instanceof Error ? error : new Error("create deal failed"),
      {
        problem: "Vytvoření dealu selhalo",
        why: "zápis do úložiště vrátil chybu",
        fix: "ověř, že klient existuje, a zkus to znovu",
        impact: "deal nebyl vytvořen",
      },
      "Create deal action failed",
    )

    return {
      status: "error",
      message: error instanceof Error ? error.message : "Deal se nepodařilo vytvořit.",
    }
  }
}

export async function updateDealAction(
  orgSlug: string,
  dealId: string,
  values: DealFormValues,
): Promise<ActionState> {
  const logger = createServerLogger({
    layer: "action",
    module: "PipelineActions",
    operation: "updateDealAction",
  })
  const ctx = await requireOrgContext(orgSlug)
  try {
    if (dealId.length === 0) {
      return { status: "error", message: "Chybí identifikátor dealu." }
    }

    const fields = normalizeFields(values)
    if (typeof fields === "string") {
      return { status: "error", message: fields }
    }

    await withUiAudit(ctx, (scope) =>
      updateDeal(scope, {
        id: dealId,
        clientId: fields.clientId,
        title: fields.title,
        valueCzk: fields.valueCzk,
        probability: fields.probability,
        expectedClose: fields.expectedClose,
        nextStep: fields.nextStep,
        offerUrl: fields.offerUrl,
      }),
    )
    revalidatePath(`/${orgSlug}/pipeline`)

    return { status: "success", message: "Deal byl upraven." }
  } catch (error) {
    logActionableError(
      logger,
      error instanceof Error ? error : new Error("update deal failed"),
      {
        problem: "Úprava dealu selhala",
        why: "zápis do úložiště vrátil chybu",
        fix: "ověř, že deal i klient existují, a zkus to znovu",
        impact: "změny dealu nebyly uloženy",
      },
      "Update deal action failed",
    )

    return {
      status: "error",
      message: error instanceof Error ? error.message : "Deal se nepodařilo upravit.",
    }
  }
}

// Partial patch behind the deal-detail inline editors: each field commits alone, a
// JSON null clears a nullable column, an absent key leaves it untouched.
export interface DealQuickEditPatch {
  valueCzk?: number
  probability?: number | null
  expectedClose?: string | null
  offerUrl?: string | null
}

export async function quickEditDealAction(
  orgSlug: string,
  dealId: string,
  patch: DealQuickEditPatch,
): Promise<ActionState> {
  const logger = createServerLogger({
    layer: "action",
    module: "PipelineActions",
    operation: "quickEditDealAction",
  })
  const ctx = await requireOrgContext(orgSlug)
  try {
    if (dealId.length === 0) {
      return { status: "error", message: "Chybí identifikátor dealu." }
    }

    let valueCzk: number | undefined
    if (patch.valueCzk !== undefined) {
      if (!Number.isFinite(patch.valueCzk) || patch.valueCzk < 0) {
        return { status: "error", message: "Zadejte hodnotu dealu." }
      }

      valueCzk = Math.round(patch.valueCzk)
    }

    let probability: number | null | undefined
    if (patch.probability !== undefined) {
      if (patch.probability === null) {
        probability = null
      } else if (
        !Number.isFinite(patch.probability) ||
        patch.probability < 0 ||
        patch.probability > 100
      ) {
        return { status: "error", message: "Pravděpodobnost musí být mezi 0 a 100." }
      } else {
        probability = Math.round(patch.probability)
      }
    }

    let expectedClose: string | null | undefined
    if (patch.expectedClose !== undefined) {
      if (patch.expectedClose === null || patch.expectedClose.trim().length === 0) {
        expectedClose = null
      } else if (!ISO_DATE.test(patch.expectedClose.trim())) {
        return { status: "error", message: "Neplatné datum očekávaného uzavření." }
      } else {
        expectedClose = patch.expectedClose.trim()
      }
    }

    let offerUrl: string | null | undefined
    if (patch.offerUrl !== undefined) {
      if (patch.offerUrl === null || patch.offerUrl.trim().length === 0) {
        offerUrl = null
      } else if (!isHttpUrl(patch.offerUrl.trim())) {
        return { status: "error", message: "Odkaz na nabídku musí být platná URL." }
      } else {
        offerUrl = patch.offerUrl.trim()
      }
    }

    await withUiAudit(ctx, (scope) =>
      updateDeal(scope, { id: dealId, valueCzk, probability, expectedClose, offerUrl }),
    )
    revalidatePath(`/${orgSlug}/pipeline`)

    return { status: "success", message: "Deal byl upraven." }
  } catch (error) {
    logActionableError(
      logger,
      error instanceof Error ? error : new Error("quick edit deal failed"),
      {
        problem: "Úprava dealu selhala",
        why: "zápis do úložiště vrátil chybu",
        fix: "ověř, že deal existuje, a zkus to znovu",
        impact: "změna dealu nebyla uložena",
      },
      "Quick edit deal action failed",
    )

    return {
      status: "error",
      message: error instanceof Error ? error.message : "Deal se nepodařilo upravit.",
    }
  }
}

// Focused write for the inline "další krok" editor on a card. The next step is the
// thing Filip acts on, so it gets a one-field save path instead of the full deal form.
export async function updateDealDescriptionAction(
  orgSlug: string,
  dealId: string,
  description: string,
): Promise<ActionState> {
  const logger = createServerLogger({
    layer: "action",
    module: "PipelineActions",
    operation: "updateDealDescriptionAction",
  })
  const ctx = await requireOrgContext(orgSlug)
  try {
    if (dealId.length === 0) {
      return { status: "error", message: "Chybí identifikátor dealu." }
    }

    const trimmed = description.trim()
    await withUiAudit(ctx, (scope) =>
      updateDeal(scope, { id: dealId, description: trimmed.length > 0 ? trimmed : null }),
    )
    revalidatePath(`/${orgSlug}/pipeline`)

    return {
      status: "success",
      message: trimmed.length > 0 ? "Popis uložen." : "Popis smazán.",
    }
  } catch (error) {
    logActionableError(
      logger,
      error instanceof Error ? error : new Error("update deal description failed"),
      {
        problem: "Uložení popisu selhalo",
        why: "zápis do úložiště vrátil chybu",
        fix: "ověř, že deal existuje, a zkus to znovu",
        impact: "popis dealu nebyl uložen",
      },
      "Update deal description action failed",
    )

    return { status: "error", message: "Popis se nepodařilo uložit." }
  }
}

export async function updateDealNextStepAction(
  orgSlug: string,
  dealId: string,
  nextStep: string,
): Promise<ActionState> {
  const logger = createServerLogger({
    layer: "action",
    module: "PipelineActions",
    operation: "updateDealNextStepAction",
  })
  const ctx = await requireOrgContext(orgSlug)
  try {
    if (dealId.length === 0) {
      return { status: "error", message: "Chybí identifikátor dealu." }
    }

    const trimmed = nextStep.trim()
    await withUiAudit(ctx, (scope) =>
      updateDeal(scope, { id: dealId, nextStep: trimmed.length > 0 ? trimmed : null }),
    )
    revalidatePath(`/${orgSlug}/pipeline`)

    return {
      status: "success",
      message: trimmed.length > 0 ? "Další krok uložen." : "Další krok smazán.",
    }
  } catch (error) {
    logActionableError(
      logger,
      error instanceof Error ? error : new Error("update deal next step failed"),
      {
        problem: "Uložení dalšího kroku selhalo",
        why: "zápis do úložiště vrátil chybu",
        fix: "ověř, že deal existuje, a zkus to znovu",
        impact: "další krok nebyl uložen",
      },
      "Update deal next step action failed",
    )

    return { status: "error", message: "Další krok se nepodařilo uložit." }
  }
}

export async function moveDealStageAction(
  orgSlug: string,
  dealId: string,
  stage: string,
): Promise<ActionState> {
  const logger = createServerLogger({
    layer: "action",
    module: "PipelineActions",
    operation: "moveDealStageAction",
  })
  const ctx = await requireOrgContext(orgSlug)
  try {
    if (dealId.length === 0) {
      return { status: "error", message: "Chybí identifikátor dealu." }
    }

    const stageOption = await findStageOption(ctx.scope.orgId, stage)
    if (stageOption === undefined) {
      return { status: "error", message: "Neznámá fáze pipeline." }
    }

    const requestId = await withUiAudit(ctx, async (scope, reqId) => {
      await moveDealStage(scope, dealId, stage)

      return reqId
    })
    revalidatePath(`/${orgSlug}/pipeline`)

    return { status: "success", message: `Deal přesunut do fáze ${stageOption.label}`, requestId }
  } catch (error) {
    logActionableError(
      logger,
      error instanceof Error ? error : new Error("move deal stage failed"),
      {
        problem: "Přesun dealu do jiné fáze selhal",
        why: "mutace nebo zápis do úložiště vrátil chybu",
        fix: "ověř, že deal existuje, a zkus to znovu",
        impact: "deal zůstal v původní fázi",
      },
      "Move deal stage action failed",
    )

    return { status: "error", message: "Deal se nepodařilo přesunout." }
  }
}

export async function reorderDealAction(
  orgSlug: string,
  dealId: string,
  stage: string,
  orderedIds: string[],
): Promise<ActionState> {
  const logger = createServerLogger({
    layer: "action",
    module: "PipelineActions",
    operation: "reorderDealAction",
  })
  const ctx = await requireOrgContext(orgSlug)
  try {
    if (dealId.length === 0) {
      return { status: "error", message: "Chybí identifikátor dealu." }
    }

    const stageOption = await findStageOption(ctx.scope.orgId, stage)
    if (stageOption === undefined) {
      return { status: "error", message: "Neznámá fáze pipeline." }
    }

    await withUiAudit(ctx, (scope) => reorderDeal(scope, dealId, stage, orderedIds))
    revalidatePath(`/${orgSlug}/pipeline`)

    return { status: "success", message: "Pořadí dealů bylo uloženo." }
  } catch (error) {
    logActionableError(
      logger,
      error instanceof Error ? error : new Error("reorder deal failed"),
      {
        problem: "Přesun dealu v pipeline selhal",
        why: "mutace nebo zápis do úložiště vrátil chybu",
        fix: "ověř, že deal existuje, a zkus to znovu",
        impact: "pořadí dealů nebylo uloženo",
      },
      "Reorder deal action failed",
    )

    return { status: "error", message: "Deal se nepodařilo přesunout." }
  }
}

export async function markDealLostAction(
  orgSlug: string,
  dealId: string,
  lostReason: string,
): Promise<ActionState> {
  const logger = createServerLogger({
    layer: "action",
    module: "PipelineActions",
    operation: "markDealLostAction",
  })
  const ctx = await requireOrgContext(orgSlug)
  try {
    if (dealId.length === 0) {
      return { status: "error", message: "Chybí identifikátor dealu." }
    }

    const reason = lostReason.trim()
    if (reason.length === 0) {
      return { status: "error", message: "Uveďte důvod prohry." }
    }

    const lostStage = await getBySemantic(ctx.scope.orgId, "deal_stage", "lost")
    const requestId = await withUiAudit(ctx, async (scope, reqId) => {
      await updateDeal(scope, { id: dealId, lostReason: reason })
      await moveDealStage(scope, dealId, lostStage.value)

      return reqId
    })
    revalidatePath(`/${orgSlug}/pipeline`)

    return { status: "success", message: "Deal označen jako prohraný.", requestId }
  } catch (error) {
    logActionableError(
      logger,
      error instanceof Error ? error : new Error("mark deal lost failed"),
      {
        problem: "Označení dealu jako prohraného selhalo",
        why: "zápis důvodu nebo změna fáze vrátily chybu",
        fix: "ověř, že deal existuje, a zkus to znovu",
        impact: "deal zůstal v původní fázi",
      },
      "Mark deal lost action failed",
    )

    return { status: "error", message: "Deal se nepodařilo označit jako prohraný." }
  }
}

export async function setDealAssigneesAction(
  orgSlug: string,
  dealId: string,
  userIds: string[],
): Promise<ActionState> {
  const logger = createServerLogger({
    layer: "action",
    module: "PipelineActions",
    operation: "setDealAssigneesAction",
  })
  const ctx = await requireOrgContext(orgSlug)
  try {
    if (dealId.length === 0) {
      return { status: "error", message: "Chybí identifikátor dealu." }
    }

    await withUiAudit(ctx, (scope) => setDealAssignees(scope, dealId, userIds))
    revalidatePath(`/${orgSlug}/pipeline`)

    return { status: "success", message: "Řešitelé byli uloženi." }
  } catch (error) {
    logActionableError(
      logger,
      error instanceof Error ? error : new Error("set deal assignees failed"),
      {
        problem: "Uložení řešitelů dealu selhalo",
        why: "zápis do úložiště vrátil chybu",
        fix: "ověř, že deal existuje a uživatelé jsou členy workspace, a zkus to znovu",
        impact: "řešitelé nebyli uloženi",
      },
      "Set deal assignees action failed",
    )

    return {
      status: "error",
      message: error instanceof Error ? error.message : "Řešitele se nepodařilo uložit.",
    }
  }
}

export async function deleteDealAction(orgSlug: string, dealId: string): Promise<ActionState> {
  const logger = createServerLogger({
    layer: "action",
    module: "PipelineActions",
    operation: "deleteDealAction",
  })
  const ctx = await requireOrgContext(orgSlug)
  try {
    if (dealId.length === 0) {
      return { status: "error", message: "Chybí identifikátor dealu." }
    }

    const requestId = await withUiAudit(ctx, async (scope, reqId) => {
      await deleteDeal(scope, dealId)

      return reqId
    })
    revalidatePath(`/${orgSlug}/pipeline`)

    return { status: "success", message: "Deal byl smazán.", requestId }
  } catch (error) {
    logActionableError(
      logger,
      error instanceof Error ? error : new Error("delete deal failed"),
      {
        problem: "Smazání dealu selhalo",
        why: "zápis do úložiště vrátil chybu",
        fix: "ověř, že deal existuje, a zkus to znovu",
        impact: "deal nebyl smazán",
      },
      "Delete deal action failed",
    )

    return {
      status: "error",
      message: error instanceof Error ? error.message : "Deal se nepodařilo smazat.",
    }
  }
}

// Read-only list of a deal's own tasks for the deal detail. Shaped like the task-detail
// subtask row so the deal detail reuses the same checklist item component; the toggle and
// delete on each row call the task-detail actions directly.
export async function listDealTicketsAction(
  orgSlug: string,
  dealId: string,
): Promise<TaskSubtask[]> {
  const ctx = await requireOrgContext(orgSlug)
  const [rows, doneOption] = await Promise.all([
    listTicketsByDeal(ctx.scope, dealId),
    getBySemantic(ctx.scope.orgId, "ticket_status", "done"),
  ])

  return rows.map((ticket) => ({
    id: ticket.id,
    title: ticket.title,
    done: ticket.status === doneOption.value,
    dueAt: ticket.dueAt ?? null,
    assignees: ticket.assignees,
  }))
}

// Last audit entries touching one deal (the deal row, its assignees, its tasks),
// pre-humanized to plain items so the client-side history section just renders.
export async function listDealHistoryAction(
  orgSlug: string,
  dealId: string,
): Promise<HistoryItem[]> {
  const ctx = await requireOrgContext(orgSlug)
  const entries = await listAuditForEntity(
    ctx.scope.orgId,
    { tableName: "deals", rowId: dealId, fkColumn: "deal_id" },
    8,
  )

  return buildHistoryItems(entries)
}

export async function addDealTicketAction(
  orgSlug: string,
  dealId: string,
  title: string,
): Promise<ActionState> {
  const ctx = await requireOrgContext(orgSlug)
  if (dealId.length === 0) {
    return { status: "error", message: "Chybí identifikátor dealu." }
  }

  if (title.trim().length === 0) {
    return { status: "error", message: "Vyplňte název úkolu." }
  }

  try {
    const enums = await loadOrgEnums(ctx.scope.orgId)
    await withUiAudit(ctx, (scope) =>
      createTicket(scope, {
        dealId,
        title: title.trim(),
        priority: pickTicketValue(enums.ticket_priority, "medium"),
        status: pickTicketValue(enums.ticket_status, "todo"),
      }),
    )
    revalidatePath(`/${orgSlug}/pipeline`)

    return { status: "success", message: "Úkol byl přidán." }
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Úkol se nepodařilo přidat.",
    }
  }
}

// Focused one-field save for the inline deal title editor on the deal detail.
export async function updateDealTitleAction(
  orgSlug: string,
  dealId: string,
  title: string,
): Promise<ActionState> {
  const logger = createServerLogger({
    layer: "action",
    module: "PipelineActions",
    operation: "updateDealTitleAction",
  })
  const ctx = await requireOrgContext(orgSlug)
  try {
    if (dealId.length === 0) {
      return { status: "error", message: "Chybí identifikátor dealu." }
    }

    const trimmed = title.trim()
    if (trimmed.length === 0) {
      return { status: "error", message: "Název dealu nesmí být prázdný." }
    }

    await withUiAudit(ctx, (scope) => updateDeal(scope, { id: dealId, title: trimmed }))
    revalidatePath(`/${orgSlug}/pipeline`)

    return { status: "success", message: "Název dealu uložen." }
  } catch (error) {
    logActionableError(
      logger,
      error instanceof Error ? error : new Error("update deal title failed"),
      {
        problem: "Uložení názvu dealu selhalo",
        why: "zápis do úložiště vrátil chybu",
        fix: "ověř, že deal existuje, a zkus to znovu",
        impact: "název dealu nebyl uložen",
      },
      "Update deal title action failed",
    )

    return { status: "error", message: "Název dealu se nepodařilo uložit." }
  }
}
