import { and, asc, eq } from "drizzle-orm"
import { resolveDbc, withTx } from "@/lib/crm/store/db"
import { clients, deals, projects, tickets } from "@/lib/db/schema/crm"
import { toClient, toProject, toTicket } from "@/lib/crm/store/mappers"
import { attachTicketAssignees } from "@/lib/crm/store/assignees"
import { assertValidValue } from "@/lib/crm/enums/service"
import { createId } from "@/lib/ids"
import { todayIso } from "@/lib/dates"
import type {
  Client,
  OrgScope,
  Project,
  ProjectStatus,
  TicketWithAssignees,
} from "@/core/types/crm.types"

const actorUserId = (scope: OrgScope): string | null =>
  scope.actor.type === "user" ? scope.actor.userId : null

// Default order keeps open work (příprava, běží, review) at the top sorted by
// nearest due, so finished, paused and maintenance projects never bury what needs
// attention today.
const ATTENTION_STATUSES: ReadonlySet<ProjectStatus> = new Set(["priprava", "bezi", "review"])

const DUE_LAST = "9999-99-99"

const byAttentionThenDue = (a: ProjectListItem, b: ProjectListItem): number => {
  const aRank = ATTENTION_STATUSES.has(a.status) ? 0 : 1
  const bRank = ATTENTION_STATUSES.has(b.status) ? 0 : 1
  if (aRank !== bRank) {
    return aRank - bRank
  }

  return (a.dueAt ?? DUE_LAST).localeCompare(b.dueAt ?? DUE_LAST)
}

export interface CreateProjectInput {
  clientId: string
  name: string
  description?: string
  status: ProjectStatus
  startedAt?: string
  dueAt?: string
  budgetCzk?: number
  dealId?: string
}

export interface UpdateProjectInput {
  clientId: string
  name: string
  description?: string
  status: ProjectStatus
  startedAt?: string
  dueAt?: string
  budgetCzk?: number
}

export interface ProjectListItem extends Project {
  clientName: string
  ticketsTotal: number
  ticketsDone: number
  ticketsOverdue: number
}

export interface ProjectDetail {
  project: Project
  client: Client
  tickets: TicketWithAssignees[]
}

export async function listProjects(scope: OrgScope): Promise<ProjectListItem[]> {
  const today = todayIso()
  const dbc = resolveDbc(scope)
  const [projectRows, clientRows, ticketRows] = await Promise.all([
    dbc
      .select()
      .from(projects)
      .where(eq(projects.organizationId, scope.orgId))
      .orderBy(asc(projects.id)),
    dbc
      .select({ id: clients.id, name: clients.name })
      .from(clients)
      .where(eq(clients.organizationId, scope.orgId)),
    dbc
      .select({ projectId: tickets.projectId, status: tickets.status, dueAt: tickets.dueAt })
      .from(tickets)
      .where(eq(tickets.organizationId, scope.orgId)),
  ])
  const names = new Map(clientRows.map((row) => [row.id, row.name]))

  return projectRows
    .map(toProject)
    .map((project) => {
      const projectTickets = ticketRows.filter((ticket) => ticket.projectId === project.id)

      return {
        ...project,
        clientName: names.get(project.clientId) ?? project.clientId,
        ticketsTotal: projectTickets.length,
        ticketsDone: projectTickets.filter((ticket) => ticket.status === "done").length,
        ticketsOverdue: projectTickets.filter(
          (ticket) => ticket.status !== "done" && ticket.dueAt !== null && ticket.dueAt < today,
        ).length,
      }
    })
    .sort(byAttentionThenDue)
}

export async function getProject(scope: OrgScope, id: string): Promise<ProjectDetail | null> {
  const dbc = resolveDbc(scope)
  const projectRows = await dbc
    .select()
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.organizationId, scope.orgId)))
    .limit(1)
  const projectRow = projectRows[0]
  if (projectRow === undefined) {
    return null
  }

  const clientRows = await dbc
    .select()
    .from(clients)
    .where(and(eq(clients.id, projectRow.clientId), eq(clients.organizationId, scope.orgId)))
    .limit(1)
  const clientRow = clientRows[0]
  if (clientRow === undefined) {
    return null
  }

  const ticketRows = await dbc
    .select()
    .from(tickets)
    .where(and(eq(tickets.projectId, id), eq(tickets.organizationId, scope.orgId)))
    .orderBy(asc(tickets.id))

  const ticketList = ticketRows.map(toTicket).sort((a, b) => a.order - b.order)

  return {
    project: toProject(projectRow),
    client: toClient(clientRow),
    tickets: await attachTicketAssignees(scope, ticketList),
  }
}

export async function createProject(scope: OrgScope, input: CreateProjectInput): Promise<Project> {
  await assertValidValue(scope.orgId, "project_status", input.status)
  const dbc = resolveDbc(scope)
  const clientRows = await dbc
    .select({ id: clients.id })
    .from(clients)
    .where(and(eq(clients.id, input.clientId), eq(clients.organizationId, scope.orgId)))
    .limit(1)
  if (clientRows[0] === undefined) {
    throw new Error("Klient nebyl nalezen.")
  }

  // A stale prefilled dealId (link from a won deal) must never hard-fail the
  // insert, so drop it when the deal no longer exists.
  let dealId: string | null = null
  if (input.dealId !== undefined && input.dealId.length > 0) {
    const dealRows = await dbc
      .select({ id: deals.id })
      .from(deals)
      .where(and(eq(deals.id, input.dealId), eq(deals.organizationId, scope.orgId)))
      .limit(1)
    dealId = dealRows[0]?.id ?? null
  }

  const rows = await dbc
    .insert(projects)
    .values({
      id: createId("pr"),
      organizationId: scope.orgId,
      clientId: input.clientId,
      dealId,
      name: input.name,
      description: input.description ?? null,
      status: input.status,
      startedAt: input.startedAt ?? null,
      dueAt: input.dueAt ?? null,
      budgetCzk: input.budgetCzk ?? null,
      createdByUserId: actorUserId(scope),
    })
    .returning()
  const row = rows[0]
  if (row === undefined) {
    throw new Error("Projekt se nepodařilo vytvořit.")
  }

  return toProject(row)
}

export async function updateProject(
  scope: OrgScope,
  id: string,
  input: UpdateProjectInput,
): Promise<Project> {
  await assertValidValue(scope.orgId, "project_status", input.status)
  const dbc = resolveDbc(scope)
  const updated = await withTx(dbc, async (tx) => {
    const existing = await tx
      .select()
      .from(projects)
      .where(and(eq(projects.id, id), eq(projects.organizationId, scope.orgId)))
      .limit(1)
    const current = existing[0]
    if (current === undefined) {
      throw new Error("Projekt nebyl nalezen.")
    }

    const clientRows = await tx
      .select({ id: clients.id })
      .from(clients)
      .where(and(eq(clients.id, input.clientId), eq(clients.organizationId, scope.orgId)))
      .limit(1)
    if (clientRows[0] === undefined) {
      throw new Error("Klient nebyl nalezen.")
    }

    const rows = await tx
      .update(projects)
      .set({
        clientId: input.clientId,
        name: input.name,
        description: input.description ?? null,
        status: input.status,
        startedAt: input.startedAt ?? null,
        dueAt: input.dueAt ?? null,
        budgetCzk: input.budgetCzk ?? null,
      })
      .where(and(eq(projects.id, id), eq(projects.organizationId, scope.orgId)))
      .returning()
    const row = rows[0]
    if (row === undefined) {
      throw new Error("Projekt nebyl nalezen.")
    }

    // Tickets denormalize clientId, so a project reassignment must carry its
    // tickets with it or the client folder view would drift.
    if (input.clientId !== current.clientId) {
      await tx
        .update(tickets)
        .set({ clientId: input.clientId })
        .where(and(eq(tickets.projectId, id), eq(tickets.organizationId, scope.orgId)))
    }

    return row
  })

  return toProject(updated)
}

export async function updateProjectStatus(
  scope: OrgScope,
  id: string,
  status: ProjectStatus,
): Promise<Project> {
  await assertValidValue(scope.orgId, "project_status", status)
  const dbc = resolveDbc(scope)
  const rows = await dbc
    .update(projects)
    .set({ status })
    .where(and(eq(projects.id, id), eq(projects.organizationId, scope.orgId)))
    .returning()
  const row = rows[0]
  if (row === undefined) {
    throw new Error("Projekt nebyl nalezen.")
  }

  return toProject(row)
}

export async function deleteProject(scope: OrgScope, id: string): Promise<void> {
  const dbc = resolveDbc(scope)
  await withTx(dbc, async (tx) => {
    const existing = await tx
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, id), eq(projects.organizationId, scope.orgId)))
      .limit(1)
    if (existing[0] === undefined) {
      throw new Error("Projekt nebyl nalezen.")
    }

    await tx
      .delete(tickets)
      .where(and(eq(tickets.projectId, id), eq(tickets.organizationId, scope.orgId)))
    await tx
      .delete(projects)
      .where(and(eq(projects.id, id), eq(projects.organizationId, scope.orgId)))
  })
}
