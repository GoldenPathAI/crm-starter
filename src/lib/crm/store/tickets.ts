import { and, asc, eq, inArray, isNotNull, isNull, lt, ne } from "drizzle-orm"
import { addDays, addMonths, format, parseISO } from "date-fns"
import type { CrmDbc } from "@/lib/db/client"
import { resolveDbc, withTx } from "@/lib/crm/store/db"
import { clients, deals, projects, ticketAssignees, tickets } from "@/lib/db/schema/crm"
import { toTicket } from "@/lib/crm/store/mappers"
import { attachTicketAssignees } from "@/lib/crm/store/assignees"
import { byDirection, isOverdueTicket } from "@/lib/crm/store/predicates"
import { assertValidValue, getBySemantic, loadOrgEnums } from "@/lib/crm/enums/service"
import { todayIso } from "@/lib/crm/config"
import { config } from "@/lib/config"
import { createId } from "@/lib/ids"
import { SortDirection, type Paginated, type SortOption } from "@/core/types/query.types"
import type {
  OrgScope,
  Ticket,
  TicketPriority,
  TicketRecurrence,
  TicketStatus,
  TicketWithAssignees,
} from "@/core/types/crm.types"

const actorUserId = (scope: OrgScope): string | null =>
  scope.actor.type === "user" ? scope.actor.userId : null

// The done column is the org's ticket_status option carrying semantic "done".
const doneStatusValue = async (scope: OrgScope): Promise<TicketStatus> => {
  const option = await getBySemantic(scope.orgId, "ticket_status", "done")

  return option.value
}

export interface CreateTicketInput {
  clientId?: string
  projectId?: string
  dealId?: string
  title: string
  description?: string
  priority: TicketPriority
  status?: TicketStatus
  dueAt?: string
  labels?: string[]
  recurrence?: TicketRecurrence
  parentId?: string
}

export interface UpdateTicketInput {
  title: string
  description?: string
  priority: TicketPriority
  status: TicketStatus
  dueAt?: string
  labels?: string[]
  recurrence?: TicketRecurrence | null
}

export type TicketSortField = "dueAt" | "priority" | "createdAt"
export type TicketGroupField = "status" | "client" | "priority"

export interface TicketListFilters {
  clientId?: string
  projectId?: string
  dealId?: string
  statuses?: TicketStatus[]
  priorities?: TicketPriority[]
  overdue?: boolean
}

export interface TicketListQuery {
  filters: TicketListFilters
  sort?: SortOption<TicketSortField>
  group?: TicketGroupField
  page: number
  pageSize?: number
}

export interface TicketListItem extends TicketWithAssignees {
  clientName: string
  projectName: string | null
  subtaskCount: number
  isOverdue: boolean
}

type TicketListRow = Omit<TicketListItem, "assignees">

const compareTickets = (
  a: TicketListRow,
  b: TicketListRow,
  sort: SortOption<TicketSortField> | undefined,
  priorityRank: ReadonlyMap<string, number>,
): number => {
  const field = sort?.field ?? "dueAt"
  const direction = sort?.direction ?? SortDirection.Asc
  if (field === "priority") {
    const rank = (ticket: Ticket): number => priorityRank.get(ticket.priority) ?? Number.MAX_SAFE_INTEGER

    return byDirection(rank(a) - rank(b), direction)
  }

  if (field === "createdAt") {
    return byDirection(a.createdAt.localeCompare(b.createdAt), direction)
  }

  const aDue = a.dueAt ?? "9999-99-99"
  const bDue = b.dueAt ?? "9999-99-99"

  return byDirection(aDue.localeCompare(bDue), direction)
}

export async function listTickets(
  scope: OrgScope,
  query: TicketListQuery,
): Promise<Paginated<TicketListItem>> {
  const { filters } = query
  const today = todayIso()
  const dbc = resolveDbc(scope)
  const doneValue = await doneStatusValue(scope)
  const enums = await loadOrgEnums(scope.orgId)
  const priorityRank = new Map(enums.ticket_priority.map((option) => [option.value, option.position]))

  const conditions = [eq(tickets.organizationId, scope.orgId), isNull(tickets.parentId)]
  if (filters.clientId !== undefined) {
    conditions.push(eq(tickets.clientId, filters.clientId))
  }

  if (filters.projectId !== undefined) {
    conditions.push(eq(tickets.projectId, filters.projectId))
  }

  if (filters.dealId !== undefined) {
    conditions.push(eq(tickets.dealId, filters.dealId))
  }

  if (filters.statuses !== undefined) {
    conditions.push(inArray(tickets.status, filters.statuses))
  }

  if (filters.priorities !== undefined) {
    conditions.push(inArray(tickets.priority, filters.priorities))
  }

  if (filters.overdue === true) {
    conditions.push(isNotNull(tickets.dueAt))
    conditions.push(ne(tickets.status, doneValue))
    conditions.push(lt(tickets.dueAt, today))
  }

  const [ticketRows, clientRows, projectRows, childRows] = await Promise.all([
    dbc.select().from(tickets).where(and(...conditions)).orderBy(asc(tickets.id)),
    dbc
      .select({ id: clients.id, name: clients.name })
      .from(clients)
      .where(eq(clients.organizationId, scope.orgId)),
    dbc
      .select({ id: projects.id, name: projects.name })
      .from(projects)
      .where(eq(projects.organizationId, scope.orgId)),
    dbc
      .select({ parentId: tickets.parentId })
      .from(tickets)
      .where(and(eq(tickets.organizationId, scope.orgId), isNotNull(tickets.parentId))),
  ])
  const names = new Map(clientRows.map((row) => [row.id, row.name]))
  const projectNames = new Map(projectRows.map((row) => [row.id, row.name]))
  const subtaskCounts = new Map<string, number>()
  for (const child of childRows) {
    if (child.parentId === null) {
      continue
    }

    subtaskCounts.set(child.parentId, (subtaskCounts.get(child.parentId) ?? 0) + 1)
  }

  const filtered = ticketRows
    .map(toTicket)
    .map((ticket) => ({
      ...ticket,
      clientName: names.get(ticket.clientId) ?? ticket.clientId,
      projectName:
        ticket.projectId === undefined ? null : projectNames.get(ticket.projectId) ?? ticket.projectId,
      subtaskCount: subtaskCounts.get(ticket.id) ?? 0,
      isOverdue: isOverdueTicket(ticket, today, doneValue),
    }))
    .sort((a, b) => compareTickets(a, b, query.sort, priorityRank))

  const total = filtered.length
  if (query.group !== undefined) {
    const items = await attachTicketAssignees(scope, filtered)

    return { items, total, page: 1, pageSize: total }
  }

  const pageSize = query.pageSize ?? config.defaultPageSize
  const page = Math.max(1, query.page)
  const start = (page - 1) * pageSize
  const items = await attachTicketAssignees(scope, filtered.slice(start, start + pageSize))

  return { items, total, page, pageSize }
}

// The board positions cards purely by `order` within a status column. A card that
// changes column must land at the end of the destination column, otherwise it keeps
// its stale order and collides with an existing card at the same position.
const appendOrderForColumn = async (
  tx: CrmDbc,
  ticket: typeof tickets.$inferSelect,
  status: TicketStatus,
): Promise<number> => {
  const siblingConditions =
    ticket.parentId !== null
      ? [eq(tickets.parentId, ticket.parentId)]
      : ticket.projectId !== null
        ? [eq(tickets.projectId, ticket.projectId), isNull(tickets.parentId), eq(tickets.status, status)]
        : [
            eq(tickets.clientId, ticket.clientId),
            isNull(tickets.projectId),
            isNull(tickets.parentId),
            eq(tickets.status, status),
          ]
  const siblings = await tx
    .select({ order: tickets.order })
    .from(tickets)
    .where(
      and(
        eq(tickets.organizationId, ticket.organizationId),
        ...siblingConditions,
        ne(tickets.id, ticket.id),
      ),
    )

  return siblings.reduce((max, sibling) => Math.max(max, sibling.order), -1) + 1
}

// date-fns addMonths clamps to the last day of a shorter month (Jan 31 + 1 month
// = Feb 28/29), which is the wanted behaviour for month-end recurring tasks.
const nextDueDate = (dueAt: string, recurrence: TicketRecurrence): string => {
  const due = parseISO(dueAt)
  const advanced =
    recurrence === "weekly"
      ? addDays(due, 7)
      : recurrence === "biweekly"
        ? addDays(due, 14)
        : recurrence === "monthly"
          ? addMonths(due, 1)
          : addMonths(due, 3)

  return format(advanced, "yyyy-MM-dd")
}

// Completing a recurring ticket spawns its next occurrence in the SAME transaction
// as the status change, so the audit batch (and undo) covers both. Fires only on the
// not-done -> done edge; re-saving an already done ticket never duplicates. The next
// occurrence copies content, links, labels, recurrence, assignees and subtasks
// (reopened), opens in createTicket's default status and advances the due date from
// the OLD due date. Assignees are copied with direct inserts: a spawn is not an
// assignment, so nobody gets notified.
async function spawnNextOccurrence(
  scope: OrgScope,
  tx: CrmDbc,
  source: typeof tickets.$inferSelect,
  oldDueAt: string | null,
): Promise<void> {
  if (source.recurrence === null || oldDueAt === null || source.parentId !== null) {
    return
  }

  const txScope: OrgScope = { ...scope, db: tx }
  const next = await createTicket(txScope, {
    clientId: source.clientId,
    projectId: source.projectId ?? undefined,
    dealId: source.dealId ?? undefined,
    title: source.title,
    description: source.description ?? undefined,
    priority: source.priority,
    dueAt: nextDueDate(oldDueAt, source.recurrence),
    labels: source.labels,
    recurrence: source.recurrence,
  })

  const assigneeRows = await tx
    .select({ userId: ticketAssignees.userId })
    .from(ticketAssignees)
    .where(eq(ticketAssignees.ticketId, source.id))
  if (assigneeRows.length > 0) {
    await tx
      .insert(ticketAssignees)
      .values(assigneeRows.map((row) => ({ id: createId("ta"), ticketId: next.id, userId: row.userId })))
  }

  const subtaskRows = await tx
    .select()
    .from(tickets)
    .where(and(eq(tickets.parentId, source.id), eq(tickets.organizationId, scope.orgId)))
    .orderBy(asc(tickets.order))
  for (const subtask of subtaskRows) {
    await createTicket(txScope, {
      clientId: source.clientId,
      projectId: source.projectId ?? undefined,
      parentId: next.id,
      title: subtask.title,
      description: subtask.description ?? undefined,
      priority: subtask.priority,
      labels: subtask.labels,
    })
  }

}

export async function updateTicketStatus(
  scope: OrgScope,
  ticketId: string,
  status: TicketStatus,
): Promise<Ticket> {
  await assertValidValue(scope.orgId, "ticket_status", status)
  const doneValue = await doneStatusValue(scope)
  const dbc = resolveDbc(scope)
  const updated = await withTx(dbc, async (tx) => {
    const existing = await tx
      .select()
      .from(tickets)
      .where(and(eq(tickets.id, ticketId), eq(tickets.organizationId, scope.orgId)))
      .limit(1)
    const current = existing[0]
    if (current === undefined) {
      throw new Error("Úkol nebyl nalezen.")
    }

    const doneAt = status === doneValue ? new Date() : null
    const order =
      status === current.status ? current.order : await appendOrderForColumn(tx, current, status)
    const rows = await tx
      .update(tickets)
      .set({ status, doneAt, order })
      .where(and(eq(tickets.id, ticketId), eq(tickets.organizationId, scope.orgId)))
      .returning()
    const row = rows[0]
    if (row === undefined) {
      throw new Error("Úkol nebyl nalezen.")
    }

    if (current.status !== doneValue && status === doneValue) {
      await spawnNextOccurrence(scope, tx, row, current.dueAt)
    }

    return row
  })

  return toTicket(updated)
}

// Vertical reorder within (or across) a board column. `orderedIds` is the full
// list of top-level card ids in the destination column in their new order, with
// the moved card already inserted at its drop index. Renumbering the whole column
// in one transaction keeps positions dense and collision-free at this scale.
export async function reorderTicket(
  scope: OrgScope,
  ticketId: string,
  status: TicketStatus,
  orderedIds: string[],
): Promise<Ticket> {
  await assertValidValue(scope.orgId, "ticket_status", status)
  const doneValue = await doneStatusValue(scope)
  const dbc = resolveDbc(scope)
  const updated = await withTx(dbc, async (tx) => {
    const existing = await tx
      .select()
      .from(tickets)
      .where(and(eq(tickets.id, ticketId), eq(tickets.organizationId, scope.orgId)))
      .limit(1)
    const current = existing[0]
    if (current === undefined) {
      throw new Error("Úkol nebyl nalezen.")
    }

    const doneAt = status === doneValue ? current.doneAt ?? new Date() : null
    let moved = current
    for (let index = 0; index < orderedIds.length; index += 1) {
      const id = orderedIds[index]
      if (id === undefined) {
        continue
      }

      const patch = id === ticketId ? { order: index, status, doneAt } : { order: index }
      const rows = await tx
        .update(tickets)
        .set(patch)
        .where(and(eq(tickets.id, id), eq(tickets.organizationId, scope.orgId)))
        .returning()
      const row = rows[0]
      if (id === ticketId && row !== undefined) {
        moved = row
      }
    }

    if (current.status !== doneValue && status === doneValue) {
      await spawnNextOccurrence(scope, tx, moved, current.dueAt)
    }

    return moved
  })

  return toTicket(updated)
}

export async function createTicket(scope: OrgScope, input: CreateTicketInput): Promise<Ticket> {
  await assertValidValue(scope.orgId, "ticket_priority", input.priority)
  if (input.status !== undefined) {
    await assertValidValue(scope.orgId, "ticket_status", input.status)
  }

  const doneValue = await doneStatusValue(scope)
  const dbc = resolveDbc(scope)
  const created = await withTx(dbc, async (tx) => {
    // Resolve the deal first: its client can seed a deal-only task and must agree with
    // any explicitly given client or project.
    let dealId: string | null = null
    let dealClientId: string | null = null
    if (input.dealId !== undefined && input.dealId.length > 0) {
      const dealRows = await tx
        .select({ id: deals.id, clientId: deals.clientId })
        .from(deals)
        .where(and(eq(deals.id, input.dealId), eq(deals.organizationId, scope.orgId)))
        .limit(1)
      const deal = dealRows[0]
      if (deal === undefined) {
        throw new Error("Deal nebyl nalezen.")
      }

      dealId = deal.id
      dealClientId = deal.clientId
    }

    // A task hangs off a project (client derived from it), directly off a client, or
    // off a deal (client derived from it).
    let clientId: string
    let projectId: string | null = null
    if (input.projectId !== undefined && input.projectId.length > 0) {
      const projectRows = await tx
        .select({ id: projects.id, clientId: projects.clientId })
        .from(projects)
        .where(and(eq(projects.id, input.projectId), eq(projects.organizationId, scope.orgId)))
        .limit(1)
      const project = projectRows[0]
      if (project === undefined) {
        throw new Error("Projekt nebyl nalezen.")
      }

      projectId = project.id
      clientId = project.clientId
    } else if (input.clientId !== undefined && input.clientId.length > 0) {
      const clientRows = await tx
        .select({ id: clients.id })
        .from(clients)
        .where(and(eq(clients.id, input.clientId), eq(clients.organizationId, scope.orgId)))
        .limit(1)
      if (clientRows[0] === undefined) {
        throw new Error("Klient nebyl nalezen.")
      }

      clientId = input.clientId
    } else if (dealClientId !== null) {
      clientId = dealClientId
    } else {
      throw new Error("Úkol potřebuje klienta, projekt nebo deal.")
    }

    // A deal-linked task must live under the deal's own client.
    if (dealClientId !== null && dealClientId !== clientId) {
      throw new Error("Deal patří jinému klientovi než úkol.")
    }

    let parentId: string | null = null
    if (input.parentId !== undefined && input.parentId.length > 0) {
      const parentRows = await tx
        .select({
          id: tickets.id,
          projectId: tickets.projectId,
          clientId: tickets.clientId,
          parentId: tickets.parentId,
        })
        .from(tickets)
        .where(and(eq(tickets.id, input.parentId), eq(tickets.organizationId, scope.orgId)))
        .limit(1)
      const parent = parentRows[0]
      const sameScope =
        projectId !== null ? parent?.projectId === projectId : parent?.clientId === clientId
      if (parent === undefined || !sameScope) {
        throw new Error("Nadřazený úkol nebyl nalezen.")
      }

      if (parent.parentId !== null) {
        throw new Error("Podúkol nemůže mít další podúkoly.")
      }

      parentId = parent.id
    }

    const status =
      input.status ?? (parentId !== null ? "todo" : projectId !== null ? "backlog" : "todo")

    const siblingConditions =
      parentId !== null
        ? [eq(tickets.parentId, parentId)]
        : projectId !== null
          ? [eq(tickets.projectId, projectId), isNull(tickets.parentId), eq(tickets.status, status)]
          : [
              eq(tickets.clientId, clientId),
              isNull(tickets.projectId),
              isNull(tickets.parentId),
              eq(tickets.status, status),
            ]
    const siblings = await tx
      .select({ order: tickets.order })
      .from(tickets)
      .where(and(eq(tickets.organizationId, scope.orgId), ...siblingConditions))
    const nextOrder = siblings.reduce((max, sibling) => Math.max(max, sibling.order), -1) + 1

    const rows = await tx
      .insert(tickets)
      .values({
        id: createId("ti"),
        organizationId: scope.orgId,
        clientId,
        projectId,
        dealId,
        parentId,
        title: input.title,
        description: input.description ?? null,
        status,
        priority: input.priority,
        dueAt: input.dueAt ?? null,
        order: nextOrder,
        labels: input.labels ?? [],
        recurrence: input.recurrence ?? null,
        doneAt: status === doneValue ? new Date() : null,
        createdByUserId: actorUserId(scope),
      })
      .returning()
    const row = rows[0]
    if (row === undefined) {
      throw new Error("Úkol se nepodařilo vytvořit.")
    }

    return row
  })

  return toTicket(created)
}

export async function updateTicket(
  scope: OrgScope,
  ticketId: string,
  input: UpdateTicketInput,
): Promise<Ticket> {
  await assertValidValue(scope.orgId, "ticket_status", input.status)
  await assertValidValue(scope.orgId, "ticket_priority", input.priority)
  const doneValue = await doneStatusValue(scope)
  const dbc = resolveDbc(scope)
  const updated = await withTx(dbc, async (tx) => {
    const existing = await tx
      .select()
      .from(tickets)
      .where(and(eq(tickets.id, ticketId), eq(tickets.organizationId, scope.orgId)))
      .limit(1)
    const current = existing[0]
    if (current === undefined) {
      throw new Error("Úkol nebyl nalezen.")
    }

    const doneAt = input.status === doneValue ? current.doneAt ?? new Date() : null
    const order =
      input.status === current.status
        ? current.order
        : await appendOrderForColumn(tx, current, input.status)
    const rows = await tx
      .update(tickets)
      .set({
        title: input.title,
        description: input.description ?? null,
        priority: input.priority,
        status: input.status,
        dueAt: input.dueAt ?? null,
        labels: input.labels ?? current.labels,
        recurrence: input.recurrence === undefined ? current.recurrence : input.recurrence,
        order,
        doneAt,
      })
      .where(and(eq(tickets.id, ticketId), eq(tickets.organizationId, scope.orgId)))
      .returning()
    const row = rows[0]
    if (row === undefined) {
      throw new Error("Úkol nebyl nalezen.")
    }

    if (current.status !== doneValue && input.status === doneValue) {
      await spawnNextOccurrence(scope, tx, row, current.dueAt)
    }

    return row
  })

  return toTicket(updated)
}

export async function deleteTicket(scope: OrgScope, ticketId: string): Promise<void> {
  const dbc = resolveDbc(scope)
  await withTx(dbc, async (tx) => {
    const existing = await tx
      .select({ id: tickets.id })
      .from(tickets)
      .where(and(eq(tickets.id, ticketId), eq(tickets.organizationId, scope.orgId)))
      .limit(1)
    if (existing[0] === undefined) {
      throw new Error("Úkol nebyl nalezen.")
    }

    // parent_id carries no FK, so subtasks must be removed explicitly.
    await tx
      .delete(tickets)
      .where(and(eq(tickets.parentId, ticketId), eq(tickets.organizationId, scope.orgId)))
    await tx
      .delete(tickets)
      .where(and(eq(tickets.id, ticketId), eq(tickets.organizationId, scope.orgId)))
  })
}

export async function toggleSubtask(scope: OrgScope, ticketId: string): Promise<Ticket> {
  const doneValue = await doneStatusValue(scope)
  const dbc = resolveDbc(scope)
  const existing = await dbc
    .select()
    .from(tickets)
    .where(and(eq(tickets.id, ticketId), eq(tickets.organizationId, scope.orgId)))
    .limit(1)
  const current = existing[0]
  if (current === undefined) {
    throw new Error("Podúkol nebyl nalezen.")
  }

  const nextStatus = current.status === doneValue ? "todo" : doneValue
  const doneAt = nextStatus === doneValue ? new Date() : null
  const rows = await dbc
    .update(tickets)
    .set({ status: nextStatus, doneAt })
    .where(and(eq(tickets.id, ticketId), eq(tickets.organizationId, scope.orgId)))
    .returning()
  const row = rows[0]
  if (row === undefined) {
    throw new Error("Podúkol nebyl nalezen.")
  }

  return toTicket(row)
}

export interface TicketDetail {
  ticket: Ticket
  clientName: string
  projectName: string | null
  parent: { id: string; title: string } | null
  subtasks: Ticket[]
}

export async function getTicketDetail(
  scope: OrgScope,
  ticketId: string,
): Promise<TicketDetail | null> {
  const dbc = resolveDbc(scope)
  const rows = await dbc
    .select()
    .from(tickets)
    .where(and(eq(tickets.id, ticketId), eq(tickets.organizationId, scope.orgId)))
    .limit(1)
  const row = rows[0]
  if (row === undefined) {
    return null
  }

  const ticket = toTicket(row)

  const [clientRows, projectRows, subtaskRows, parentRows] = await Promise.all([
    dbc
      .select({ name: clients.name })
      .from(clients)
      .where(and(eq(clients.id, row.clientId), eq(clients.organizationId, scope.orgId)))
      .limit(1),
    row.projectId !== null
      ? dbc
          .select({ name: projects.name })
          .from(projects)
          .where(and(eq(projects.id, row.projectId), eq(projects.organizationId, scope.orgId)))
          .limit(1)
      : Promise.resolve([]),
    row.parentId === null
      ? dbc
          .select()
          .from(tickets)
          .where(and(eq(tickets.parentId, ticketId), eq(tickets.organizationId, scope.orgId)))
          .orderBy(asc(tickets.order))
      : Promise.resolve([]),
    row.parentId !== null
      ? dbc
          .select({ id: tickets.id, title: tickets.title })
          .from(tickets)
          .where(and(eq(tickets.id, row.parentId), eq(tickets.organizationId, scope.orgId)))
          .limit(1)
      : Promise.resolve([]),
  ])

  return {
    ticket,
    clientName: clientRows[0]?.name ?? row.clientId,
    projectName: row.projectId !== null ? projectRows[0]?.name ?? row.projectId : null,
    parent: parentRows[0] ?? null,
    subtasks: subtaskRows.map(toTicket),
  }
}

// Top-level tasks hanging directly off a deal, for the pipeline deal detail. Open
// tasks first (done sinks to the bottom), then earliest due date, then creation order.
// Subtasks are excluded; they surface under their own parent task.
export async function listTicketsByDeal(
  scope: OrgScope,
  dealId: string,
): Promise<TicketWithAssignees[]> {
  const dbc = resolveDbc(scope)
  const doneValue = await doneStatusValue(scope)
  const rows = await dbc
    .select()
    .from(tickets)
    .where(
      and(
        eq(tickets.organizationId, scope.orgId),
        eq(tickets.dealId, dealId),
        isNull(tickets.parentId),
      ),
    )
  const sorted = rows
    .map(toTicket)
    .sort((a, b) => {
      const aDone = a.status === doneValue
      const bDone = b.status === doneValue
      if (aDone !== bDone) {
        return aDone ? 1 : -1
      }

      const aDue = a.dueAt ?? "9999-99-99"
      const bDue = b.dueAt ?? "9999-99-99"
      if (aDue !== bDue) {
        return aDue.localeCompare(bDue)
      }

      return a.createdAt.localeCompare(b.createdAt)
    })

  return attachTicketAssignees(scope, sorted)
}

// Partial field edit for the task detail surface. Every field is optional; a
// `null` on a nullable column clears it, an absent key leaves it untouched.
// Reassigning `projectId` re-derives the client from the project; clearing it
// (null) keeps the client. Scope or status changes append the card to the end
// of its destination column, and a parent's scope change cascades to subtasks.
export interface TicketPatch {
  title?: string
  description?: string | null
  priority?: TicketPriority
  status?: TicketStatus
  dueAt?: string | null
  labels?: string[]
  recurrence?: TicketRecurrence | null
  clientId?: string
  projectId?: string | null
}

export async function patchTicket(
  scope: OrgScope,
  ticketId: string,
  patch: TicketPatch,
): Promise<Ticket> {
  if (patch.status !== undefined) {
    await assertValidValue(scope.orgId, "ticket_status", patch.status)
  }

  if (patch.priority !== undefined) {
    await assertValidValue(scope.orgId, "ticket_priority", patch.priority)
  }

  const doneValue = await doneStatusValue(scope)
  const dbc = resolveDbc(scope)
  const updated = await withTx(dbc, async (tx) => {
    const existing = await tx
      .select()
      .from(tickets)
      .where(and(eq(tickets.id, ticketId), eq(tickets.organizationId, scope.orgId)))
      .limit(1)
    const current = existing[0]
    if (current === undefined) {
      throw new Error("Úkol nebyl nalezen.")
    }

    // A subtask inherits client and project from its parent; only content fields are editable.
    if (current.parentId !== null && (patch.clientId !== undefined || patch.projectId !== undefined)) {
      throw new Error("Podúkol přebírá klienta a projekt z nadřazeného úkolu.")
    }

    let clientId = current.clientId
    let projectId = current.projectId
    if (patch.projectId !== undefined) {
      if (patch.projectId === null) {
        projectId = null
        if (patch.clientId !== undefined && patch.clientId.length > 0) {
          clientId = patch.clientId
        }
      } else {
        const projectRows = await tx
          .select({ id: projects.id, clientId: projects.clientId })
          .from(projects)
          .where(and(eq(projects.id, patch.projectId), eq(projects.organizationId, scope.orgId)))
          .limit(1)
        const project = projectRows[0]
        if (project === undefined) {
          throw new Error("Projekt nebyl nalezen.")
        }

        projectId = project.id
        clientId = project.clientId
      }
    } else if (patch.clientId !== undefined && patch.clientId.length > 0) {
      const clientRows = await tx
        .select({ id: clients.id })
        .from(clients)
        .where(and(eq(clients.id, patch.clientId), eq(clients.organizationId, scope.orgId)))
        .limit(1)
      if (clientRows[0] === undefined) {
        throw new Error("Klient nebyl nalezen.")
      }

      clientId = patch.clientId
    }

    const status = patch.status ?? current.status
    const doneAt = status === doneValue ? current.doneAt ?? new Date() : null
    const isTopLevel = current.parentId === null
    const scopeChanged = clientId !== current.clientId || projectId !== current.projectId
    const statusChanged = status !== current.status
    const order =
      isTopLevel && (scopeChanged || statusChanged)
        ? await appendOrderForColumn(tx, { ...current, clientId, projectId }, status)
        : current.order

    const set: Partial<typeof tickets.$inferInsert> = {
      clientId,
      projectId,
      status,
      doneAt,
      order,
    }
    if (patch.title !== undefined) {
      set.title = patch.title
    }

    if (patch.description !== undefined) {
      set.description = patch.description
    }

    if (patch.priority !== undefined) {
      set.priority = patch.priority
    }

    if (patch.dueAt !== undefined) {
      set.dueAt = patch.dueAt
    }

    if (patch.labels !== undefined) {
      set.labels = patch.labels
    }

    if (patch.recurrence !== undefined) {
      set.recurrence = patch.recurrence
    }

    const rows = await tx
      .update(tickets)
      .set(set)
      .where(and(eq(tickets.id, ticketId), eq(tickets.organizationId, scope.orgId)))
      .returning()
    const row = rows[0]
    if (row === undefined) {
      throw new Error("Úkol nebyl nalezen.")
    }

    if (current.status !== doneValue && status === doneValue) {
      await spawnNextOccurrence(scope, tx, row, current.dueAt)
    }

    if (isTopLevel && scopeChanged) {
      await tx
        .update(tickets)
        .set({ clientId, projectId })
        .where(and(eq(tickets.parentId, ticketId), eq(tickets.organizationId, scope.orgId)))
    }

    return row
  })

  return toTicket(updated)
}
