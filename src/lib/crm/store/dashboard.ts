import { differenceInCalendarDays, parseISO } from "date-fns"
import { asc, eq } from "drizzle-orm"
import { resolveDbc } from "@/lib/crm/store/db"
import { clients, deals, projects, tickets } from "@/lib/db/schema/crm"
import { toClient, toDeal, toProject, toTicket } from "@/lib/crm/store/mappers"
import { isOverdueTicket } from "@/lib/crm/store/predicates"
import { loadOrgEnums, type OrgEnums } from "@/lib/crm/enums/service"
import { getOrgSettings } from "@/lib/crm/store/org-settings"
import { todayIso } from "@/lib/dates"
import type { DealStage, EnumKind, OrgScope, TicketPriority } from "@/core/types/crm.types"

export interface PipelineStageValue {
  stage: DealStage
  label: string
  count: number
  sumCzk: number
}

export interface UpcomingDeadline {
  id: string
  kind: "ticket" | "project"
  title: string
  clientId: string
  clientName: string
  dueAt: string
  daysUntil: number
}

// "Co hoří" items: everything already past its date or stalled, surfaced on the
// morning screen so nothing urgent hides below a wall of future deadlines.
export interface OverdueTicketItem {
  id: string
  title: string
  clientId: string
  clientName: string
  projectId?: string
  dueAt: string
  daysOverdue: number
  priority: TicketPriority
}

export type StuckDealReason = "no_next_step" | "stale"

export interface StuckDealItem {
  id: string
  title: string
  clientId: string
  clientName: string
  stage: DealStage
  valueCzk: number
  daysInStage: number
  reason: StuckDealReason
}

export interface DashboardData {
  activeClientsCount: number
  mrrCzk: number
  openDealsCount: number
  openPipelineCzk: number
  weightedPipelineCzk: number
  overdueTicketsCount: number
  pipelineByStage: PipelineStageValue[]
  upcomingDeadlines: UpcomingDeadline[]
  overdueTickets: OverdueTicketItem[]
  stuckDeals: StuckDealItem[]
}

const semanticValue = (enums: OrgEnums, kind: EnumKind, semantic: string): string => {
  const found = enums[kind].find((option) => option.semantic === semantic)
  if (found === undefined) {
    throw new Error(`Chybí povinná hodnota číselníku ${kind}/${semantic}.`)
  }
  return found.value
}

export async function getDashboardData(scope: OrgScope): Promise<DashboardData> {
  const today = todayIso()
  const dbc = resolveDbc(scope)
  const [enums, settings, clientRows, dealRows, projectRows, ticketRows] = await Promise.all([
    loadOrgEnums(scope.orgId),
    getOrgSettings(scope.orgId),
    dbc.select().from(clients).where(eq(clients.organizationId, scope.orgId)).orderBy(asc(clients.id)),
    dbc.select().from(deals).where(eq(deals.organizationId, scope.orgId)).orderBy(asc(deals.id)),
    dbc.select().from(projects).where(eq(projects.organizationId, scope.orgId)).orderBy(asc(projects.id)),
    dbc.select().from(tickets).where(eq(tickets.organizationId, scope.orgId)).orderBy(asc(tickets.id)),
  ])

  const activeClientStatus = semanticValue(enums, "client_status", "active")
  const doneTicketStatus = semanticValue(enums, "ticket_status", "done")
  const doneProjectStatus = semanticValue(enums, "project_status", "done")
  // Actively-progressing stages: the "open" group, excludes parked (set aside) and terminal.
  const activeStages = enums.deal_stage.filter((option) => option.semantic === "open")
  const priorityOrder = enums.ticket_priority.map((option) => option.value)

  const clientList = clientRows.map(toClient)
  const dealsAll = dealRows.map(toDeal)
  const projectsAll = projectRows.map(toProject)
  const ticketsAll = ticketRows.map(toTicket)
  const names = new Map(clientList.map((client) => [client.id, client.name]))
  const daysUntilDate = (iso: string): number =>
    differenceInCalendarDays(parseISO(iso), parseISO(today))

  // "Open pipeline" everywhere in the app means the actively-progressing stages only.
  const activeStageValues = new Set(activeStages.map((option) => option.value))
  const openDeals = dealsAll.filter((deal) => activeStageValues.has(deal.stage))

  const pipelineByStage: PipelineStageValue[] = activeStages.map((option) => {
    const stageDeals = dealsAll.filter((deal) => deal.stage === option.value)
    return {
      stage: option.value,
      label: option.label,
      count: stageDeals.length,
      sumCzk: stageDeals.reduce((sum, deal) => sum + deal.valueCzk, 0),
    }
  })

  const ticketDeadlines: UpcomingDeadline[] = ticketsAll
    .filter(
      (ticket) =>
        ticket.parentId === undefined &&
        ticket.dueAt !== undefined &&
        ticket.status !== doneTicketStatus,
    )
    .map((ticket) => ({
      id: ticket.id,
      kind: "ticket" as const,
      title: ticket.title,
      clientId: ticket.clientId,
      clientName: names.get(ticket.clientId) ?? ticket.clientId,
      dueAt: ticket.dueAt ?? today,
      daysUntil: daysUntilDate(ticket.dueAt ?? today),
    }))

  const projectDeadlines: UpcomingDeadline[] = projectsAll
    .filter((project) => project.dueAt !== undefined && project.status !== doneProjectStatus)
    .map((project) => ({
      id: project.id,
      kind: "project" as const,
      title: project.name,
      clientId: project.clientId,
      clientName: names.get(project.clientId) ?? project.clientId,
      dueAt: project.dueAt ?? today,
      daysUntil: daysUntilDate(project.dueAt ?? today),
    }))

  const upcomingDeadlines = [...ticketDeadlines, ...projectDeadlines]
    .filter((deadline) => deadline.daysUntil >= 0 && deadline.daysUntil <= 14)
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt))

  const overdueTickets: OverdueTicketItem[] = ticketsAll
    .filter((ticket) => isOverdueTicket(ticket, today, doneTicketStatus))
    .map((ticket) => ({
      id: ticket.id,
      title: ticket.title,
      clientId: ticket.clientId,
      clientName: names.get(ticket.clientId) ?? ticket.clientId,
      projectId: ticket.projectId,
      // isOverdueTicket already guarantees dueAt is defined and in the past.
      dueAt: ticket.dueAt ?? today,
      daysOverdue: -daysUntilDate(ticket.dueAt ?? today),
      priority: ticket.priority,
    }))
    .sort(
      (a, b) =>
        a.dueAt.localeCompare(b.dueAt) ||
        priorityOrder.indexOf(a.priority) - priorityOrder.indexOf(b.priority),
    )

  // "Co hoří" only makes sense for actively-progressing deals: parked is set aside on
  // purpose and terminal stages are finished, so none of them can be "stuck".
  const stuckDeals: StuckDealItem[] = openDeals
    .map((deal) => ({
      deal,
      daysInStage: Math.max(0, -daysUntilDate(deal.stageChangedAt)),
      hasNextStep: deal.nextStep !== undefined && deal.nextStep.trim().length > 0,
    }))
    .filter(({ daysInStage, hasNextStep }) => !hasNextStep || daysInStage >= settings.staleDealDays)
    .map(({ deal, daysInStage, hasNextStep }) => ({
      id: deal.id,
      title: deal.title,
      clientId: deal.clientId,
      clientName: names.get(deal.clientId) ?? deal.clientId,
      stage: deal.stage,
      valueCzk: deal.valueCzk,
      daysInStage,
      reason: hasNextStep ? ("stale" as const) : ("no_next_step" as const),
    }))
    .sort((a, b) => b.valueCzk - a.valueCzk)

  const activeClients = clientList.filter((client) => client.status === activeClientStatus)

  return {
    activeClientsCount: activeClients.length,
    mrrCzk: activeClients.reduce((sum, client) => sum + (client.mrrCzk ?? 0), 0),
    openDealsCount: openDeals.length,
    openPipelineCzk: openDeals.reduce((sum, deal) => sum + deal.valueCzk, 0),
    weightedPipelineCzk: openDeals.reduce(
      (sum, deal) => sum + deal.valueCzk * ((deal.probability ?? 0) / 100),
      0,
    ),
    overdueTicketsCount: overdueTickets.length,
    pipelineByStage,
    upcomingDeadlines,
    overdueTickets,
    stuckDeals,
  }
}
