export { listClients, getClient } from "@/lib/crm/store/clients"
export type {
  ClientListItem,
  ClientSortField,
  ClientGroupField,
  ClientListFilters,
  ClientListQuery,
  ClientDetail,
} from "@/lib/crm/store/clients"

export { listDealsByStage } from "@/lib/crm/store/deals"
export type { DealCard, DealStageColumn } from "@/lib/crm/store/deals"

export { listProjects, getProject } from "@/lib/crm/store/projects"
export type { ProjectListItem, ProjectDetail } from "@/lib/crm/store/projects"

export { listTickets } from "@/lib/crm/store/tickets"
export type {
  TicketSortField,
  TicketGroupField,
  TicketListFilters,
  TicketListQuery,
  TicketListItem,
} from "@/lib/crm/store/tickets"

export { getDashboardData } from "@/lib/crm/store/dashboard"
export type {
  PipelineStageValue,
  UpcomingDeadline,
  DashboardData,
} from "@/lib/crm/store/dashboard"
