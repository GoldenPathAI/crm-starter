import { loadOrgEnums } from "@/lib/crm/enums/service"
import { listTickets } from "@/lib/crm/store/tickets"
import { businessToday } from "@/lib/dates"
import type { OrgScope } from "@/core/types/crm.types"

// The morning cockpit caps the column so the block stays compact; the full total
// drives the "+N dalších" affordance and the module link.
const TODAY_COLUMN_LIMIT = 5

export interface TodayTicket {
  id: string
  title: string
  clientId: string
  clientName: string
}

export interface TodayPanelData {
  tickets: TodayTicket[]
  ticketsTotal: number
}

// Today's worklist for the dashboard: open úkoly whose termín is today, most urgent
// first, capped with the full total for the column link.
export async function loadTodayPanel(scope: OrgScope): Promise<TodayPanelData> {
  const today = businessToday()
  const [enums, ticketPage] = await Promise.all([
    loadOrgEnums(scope.orgId),
    listTickets(scope, { filters: {}, page: 1, group: "client" }),
  ])

  const doneValue = enums.ticket_status.find((option) => option.semantic === "done")?.value
  const priorityRank = new Map(
    enums.ticket_priority.map((option) => [option.value, option.position]),
  )

  const dueTickets = ticketPage.items
    .filter((ticket) => ticket.status !== doneValue && ticket.dueAt === today)
    .sort(
      (a, b) =>
        (priorityRank.get(a.priority) ?? Number.MAX_SAFE_INTEGER) -
        (priorityRank.get(b.priority) ?? Number.MAX_SAFE_INTEGER),
    )

  const tickets: TodayTicket[] = dueTickets.slice(0, TODAY_COLUMN_LIMIT).map((ticket) => ({
    id: ticket.id,
    title: ticket.title,
    clientId: ticket.clientId,
    clientName: ticket.clientName,
  }))

  return { tickets, ticketsTotal: dueTickets.length }
}
