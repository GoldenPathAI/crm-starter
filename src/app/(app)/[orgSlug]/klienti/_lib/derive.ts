import type { Deal, Project, Ticket } from "@/core/types/crm.types"

export const isOpenDeal = (deal: Deal): boolean =>
  deal.stage !== "vyhrano" && deal.stage !== "prohrano"

export const isActiveProject = (project: Project): boolean =>
  project.status !== "hotovo" && project.status !== "pozastaveno"

export interface TicketCounts {
  done: number
  total: number
}

export const ticketCountsFor = (tickets: Ticket[], projectId: string): TicketCounts => {
  const scoped = tickets.filter((ticket) => ticket.projectId === projectId)

  return {
    done: scoped.filter((ticket) => ticket.status === "done").length,
    total: scoped.length,
  }
}
