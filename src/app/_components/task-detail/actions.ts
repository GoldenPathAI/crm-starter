"use server"

import { revalidatePath } from "next/cache"
import { requireOrgContext } from "@/lib/auth/org-context"
import { orgHref } from "@/lib/nav"
import {
  createTicket,
  deleteTicket,
  getTicketDetail,
  patchTicket,
  toggleSubtask,
} from "@/lib/crm/store/tickets"
import { getTicketAssignees, setTicketAssignees } from "@/lib/crm/store/assignees"
import { listClients } from "@/lib/crm/store/clients"
import { listProjects } from "@/lib/crm/store/projects"
import { listOrgMembers } from "@/lib/crm/store/members"
import { getBySemantic, loadOrgEnums } from "@/lib/crm/enums/service"
import { listAuditForEntity } from "@/lib/crm/audit/queries"
import { buildHistoryItems, type HistoryItem } from "@/app/_components/HistoryCard"
import { withUiAudit } from "@/app/_lib/auditedAction"
import type { ActionState } from "@/app/_lib/actionState"
import { isTicketRecurrence } from "@/core/types/crm.types"
import type { EnumOption } from "@/core/types/crm.types"
import type {
  CreateTaskInput,
  TaskDetailData,
  TaskDetailOptions,
  TaskFieldPatch,
} from "./types"

const optionalText = (value: string): string | undefined => {
  const trimmed = value.trim()

  return trimmed.length > 0 ? trimmed : undefined
}

const pickValue = (options: EnumOption[], semantic: string): string => {
  const chosen = options.find((option) => option.semantic === semantic) ?? options[0]
  if (chosen === undefined) {
    throw new Error("Číselník úkolů neobsahuje žádnou hodnotu.")
  }

  return chosen.value
}

const revalidateScope = (
  orgSlug: string,
  clientId: string,
  projectId: string | null,
): void => {
  revalidatePath(orgHref(orgSlug, "/ukoly"))
  revalidatePath(orgHref(orgSlug, "/projekty"))
  revalidatePath(orgHref(orgSlug, `/klienti/${clientId}`))
  if (projectId !== null) {
    revalidatePath(orgHref(orgSlug, `/projekty/${projectId}`))
  }
}

export async function loadTaskAction(
  orgSlug: string,
  ticketId: string,
): Promise<TaskDetailData | null> {
  const ctx = await requireOrgContext(orgSlug)
  const detail = await getTicketDetail(ctx.scope, ticketId)
  if (detail === null) {
    return null
  }

  const { ticket, clientName, projectName, parent, subtasks } = detail
  const [assigneesByTicket, doneOption] = await Promise.all([
    getTicketAssignees(ctx.scope, [ticket.id, ...subtasks.map((subtask) => subtask.id)]),
    getBySemantic(ctx.scope.orgId, "ticket_status", "done"),
  ])

  return {
    id: ticket.id,
    clientId: ticket.clientId,
    clientName,
    projectId: ticket.projectId ?? null,
    projectName,
    parent,
    title: ticket.title,
    description: ticket.description ?? "",
    status: ticket.status,
    priority: ticket.priority,
    dueAt: ticket.dueAt ?? null,
    labels: ticket.labels,
    recurrence: ticket.recurrence ?? null,
    assignees: assigneesByTicket[ticket.id] ?? [],
    subtasks: subtasks.map((subtask) => ({
      id: subtask.id,
      title: subtask.title,
      done: subtask.status === doneOption.value,
      dueAt: subtask.dueAt ?? null,
      assignees: assigneesByTicket[subtask.id] ?? [],
    })),
  }
}

// Last audit entries touching one task (the ticket row plus its assignee links),
// pre-humanized to plain items so the modal's collapsible history just renders.
export async function loadTaskHistoryAction(
  orgSlug: string,
  ticketId: string,
): Promise<HistoryItem[]> {
  const ctx = await requireOrgContext(orgSlug)
  const entries = await listAuditForEntity(
    ctx.scope.orgId,
    { tableName: "tickets", rowId: ticketId, fkColumn: "ticket_id" },
    8,
  )

  return buildHistoryItems(entries)
}

export async function loadTaskOptionsAction(orgSlug: string): Promise<TaskDetailOptions> {
  const ctx = await requireOrgContext(orgSlug)
  const [clientResult, projects, enums, members] = await Promise.all([
    listClients(ctx.scope, { filters: {}, page: 1, group: "status" }),
    listProjects(ctx.scope),
    loadOrgEnums(ctx.scope.orgId),
    listOrgMembers(ctx.scope.orgId),
  ])
  const clients = clientResult.items
    .map((client) => ({ value: client.id, label: client.name }))
    .sort((a, b) => a.label.localeCompare(b.label, "cs"))

  const projectsByClient: Record<string, { value: string; label: string }[]> = {}
  for (const project of projects) {
    const list = projectsByClient[project.clientId] ?? []
    list.push({ value: project.id, label: project.name })
    projectsByClient[project.clientId] = list
  }

  return {
    clients,
    projectsByClient,
    statusOptions: enums.ticket_status,
    priorityOptions: enums.ticket_priority,
    members,
  }
}

export async function setTicketAssigneesAction(
  orgSlug: string,
  ticketId: string,
  userIds: string[],
): Promise<ActionState> {
  const ctx = await requireOrgContext(orgSlug)
  try {
    const before = await getTicketDetail(ctx.scope, ticketId)
    await withUiAudit(ctx, (scope) => setTicketAssignees(scope, ticketId, userIds))
    if (before !== null) {
      revalidateScope(orgSlug, before.ticket.clientId, before.ticket.projectId ?? null)
    }

    return { status: "success", message: "Řešitelé byli uloženi." }
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Řešitele se nepodařilo uložit.",
    }
  }
}

export async function patchTaskAction(
  orgSlug: string,
  input: {
    ticketId: string
    patch: TaskFieldPatch
  },
): Promise<ActionState> {
  const ctx = await requireOrgContext(orgSlug)
  if (input.patch.title !== undefined && input.patch.title.trim().length === 0) {
    return { status: "error", message: "Název úkolu nesmí být prázdný." }
  }

  if (
    input.patch.recurrence !== undefined &&
    input.patch.recurrence !== null &&
    !isTicketRecurrence(input.patch.recurrence)
  ) {
    return { status: "error", message: "Neplatná hodnota opakování." }
  }

  try {
    const before = await getTicketDetail(ctx.scope, input.ticketId)
    const normalized: TaskFieldPatch =
      input.patch.title !== undefined
        ? { ...input.patch, title: input.patch.title.trim() }
        : input.patch
    const updated = await withUiAudit(ctx, (scope) =>
      patchTicket(scope, input.ticketId, normalized),
    )
    if (before !== null) {
      revalidateScope(orgSlug, before.ticket.clientId, before.ticket.projectId ?? null)
    }

    revalidateScope(orgSlug, updated.clientId, updated.projectId ?? null)

    return { status: "success", message: "Úkol byl uložen." }
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Úkol se nepodařilo uložit.",
    }
  }
}

export async function createTaskAction(
  orgSlug: string,
  input: CreateTaskInput,
): Promise<ActionState> {
  const ctx = await requireOrgContext(orgSlug)
  const projectId = optionalText(input.projectId)
  const clientId = optionalText(input.clientId)
  if (projectId === undefined && clientId === undefined) {
    return { status: "error", message: "Vyberte klienta nebo projekt." }
  }

  if (input.title.trim().length === 0) {
    return { status: "error", message: "Vyplňte název úkolu." }
  }

  const recurrence = optionalText(input.recurrence)
  if (recurrence !== undefined && !isTicketRecurrence(recurrence)) {
    return { status: "error", message: "Neplatná hodnota opakování." }
  }

  try {
    const ticket = await withUiAudit(ctx, (scope) =>
      createTicket(scope, {
        clientId,
        projectId,
        title: input.title.trim(),
        description: optionalText(input.description),
        priority: input.priority,
        status: input.status,
        dueAt: optionalText(input.dueAt),
        labels: input.labels,
        recurrence,
      }),
    )
    revalidateScope(orgSlug, ticket.clientId, ticket.projectId ?? null)

    return { status: "success", message: "Úkol byl vytvořen." }
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Úkol se nepodařilo vytvořit.",
    }
  }
}

export async function addSubtaskAction(
  orgSlug: string,
  input: {
    parentId: string
    title: string
  },
): Promise<ActionState> {
  const ctx = await requireOrgContext(orgSlug)
  if (input.title.trim().length === 0) {
    return { status: "error", message: "Vyplňte název podúkolu." }
  }

  try {
    const parent = await getTicketDetail(ctx.scope, input.parentId)
    if (parent === null) {
      return { status: "error", message: "Nadřazený úkol nebyl nalezen." }
    }

    const enums = await loadOrgEnums(ctx.scope.orgId)
    await withUiAudit(ctx, (scope) =>
      createTicket(scope, {
        clientId: parent.ticket.clientId,
        projectId: parent.ticket.projectId,
        parentId: input.parentId,
        title: input.title.trim(),
        priority: pickValue(enums.ticket_priority, "medium"),
        status: pickValue(enums.ticket_status, "todo"),
      }),
    )
    revalidateScope(orgSlug, parent.ticket.clientId, parent.ticket.projectId ?? null)

    return { status: "success", message: "Podúkol byl přidán." }
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Podúkol se nepodařilo přidat.",
    }
  }
}

export async function toggleSubtaskAction(
  orgSlug: string,
  input: { subtaskId: string },
): Promise<ActionState> {
  const ctx = await requireOrgContext(orgSlug)
  try {
    const updated = await withUiAudit(ctx, (scope) => toggleSubtask(scope, input.subtaskId))
    revalidateScope(orgSlug, updated.clientId, updated.projectId ?? null)

    return { status: "success", message: "Podúkol byl aktualizován." }
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Podúkol se nepodařilo aktualizovat.",
    }
  }
}

export async function deleteTaskAction(
  orgSlug: string,
  input: { ticketId: string },
): Promise<ActionState> {
  const ctx = await requireOrgContext(orgSlug)
  try {
    const before = await getTicketDetail(ctx.scope, input.ticketId)
    const requestId = await withUiAudit(ctx, async (scope, reqId) => {
      await deleteTicket(scope, input.ticketId)

      return reqId
    })
    if (before !== null) {
      revalidateScope(orgSlug, before.ticket.clientId, before.ticket.projectId ?? null)
    }

    return { status: "success", message: "Úkol byl smazán.", requestId }
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Úkol se nepodařilo smazat.",
    }
  }
}
