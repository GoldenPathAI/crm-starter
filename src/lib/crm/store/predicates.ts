import { SortDirection } from "@/core/types/query.types"
import type { Deal, Project, Ticket } from "@/core/types/crm.types"

export const isOpenDeal = (deal: Deal, closedStageValues: readonly string[]): boolean =>
  !closedStageValues.includes(deal.stage)

export const isActiveProject = (project: Project, inactiveStatusValues: readonly string[]): boolean =>
  !inactiveStatusValues.includes(project.status)

export const isOverdueTicket = (ticket: Ticket, today: string, doneStatusValue: string): boolean =>
  ticket.dueAt !== undefined && ticket.status !== doneStatusValue && ticket.dueAt < today

export const byDirection = (value: number, direction: SortDirection): number =>
  direction === SortDirection.Desc ? -value : value
