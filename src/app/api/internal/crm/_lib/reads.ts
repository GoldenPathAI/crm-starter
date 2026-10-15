import { addDays, format } from "date-fns"
import { and, asc, count, desc, eq, isNotNull, isNull, lte, ne } from "drizzle-orm"
import { db } from "@/lib/db/client"
import { activities, clients, documents, projects, tickets } from "@/lib/db/schema/crm"
import { toActivity, toDoc, toTicket } from "@/lib/crm/store/mappers"
import { attachTicketAssignees } from "@/lib/crm/store/assignees"
import { isOverdueTicket } from "@/lib/crm/store/predicates"
import { todayIso } from "@/lib/dates"
import { HttpError } from "./http"
import type { TicketListItem } from "@/lib/crm/store/tickets"
import type { Paginated } from "@/core/types/query.types"
import type { Activity, Doc, Ticket } from "@/core/types/crm.types"

// The reads the store layer does not expose. Everything else routes through the
// store facades; these stay here so the control plane can serve a per-client
// activity feed, merge ticket/document PATCHes against current state, and answer
// the two date-window ticket views the store filter shape does not cover.

export async function getTicketById(orgId: string, id: string): Promise<Ticket | null> {
  const rows = await db
    .select()
    .from(tickets)
    .where(and(eq(tickets.id, id), eq(tickets.organizationId, orgId)))
    .limit(1)
  const row = rows[0]

  return row === undefined ? null : toTicket(row)
}

export async function getDocumentById(orgId: string, id: string): Promise<Doc | null> {
  const rows = await db
    .select()
    .from(documents)
    .where(and(eq(documents.id, id), eq(documents.organizationId, orgId)))
    .limit(1)
  const row = rows[0]

  return row === undefined ? null : toDoc(row)
}

export async function listActivitiesByClient(orgId: string, clientId: string): Promise<Activity[]> {
  const clientRows = await db
    .select({ id: clients.id })
    .from(clients)
    .where(and(eq(clients.id, clientId), eq(clients.organizationId, orgId)))
    .limit(1)
  if (clientRows[0] === undefined) {
    throw new HttpError(404, "Klient nebyl nalezen.")
  }

  const rows = await db
    .select()
    .from(activities)
    .where(and(eq(activities.clientId, clientId), eq(activities.organizationId, orgId)))
    .orderBy(desc(activities.occurredAt), asc(activities.id))

  return rows.map(toActivity)
}

// The `due` query param of GET /tickets and the CLI verbs `tickets dnes|tyden`.
export const TICKET_DUE_WINDOWS = ["dnes", "tyden"] as const

export type TicketDueWindow = (typeof TICKET_DUE_WINDOWS)[number]

// "Due today" and "due within a week" are supersets of the store's overdue view
// (dueAt not null, not done) bounded at the top by today / today + 7 days. The
// store couples its overdue filter to `dueAt < today`, so this window read lives
// here and reuses the same enrichment shape the list endpoint returns.
export async function listTicketsDue(
  orgId: string,
  window: TicketDueWindow,
): Promise<Paginated<TicketListItem>> {
  const today = todayIso()
  const until = window === "dnes" ? today : format(addDays(new Date(), 7), "yyyy-MM-dd")

  const [ticketRows, clientRows, projectRows, childRows] = await Promise.all([
    db
      .select()
      .from(tickets)
      .where(
        and(
          eq(tickets.organizationId, orgId),
          isNull(tickets.parentId),
          isNotNull(tickets.dueAt),
          ne(tickets.status, "done"),
          lte(tickets.dueAt, until),
        ),
      )
      .orderBy(asc(tickets.dueAt), asc(tickets.id)),
    db
      .select({ id: clients.id, name: clients.name })
      .from(clients)
      .where(eq(clients.organizationId, orgId)),
    db
      .select({ id: projects.id, name: projects.name })
      .from(projects)
      .where(eq(projects.organizationId, orgId)),
    db
      .select({ parentId: tickets.parentId, subtasks: count() })
      .from(tickets)
      .where(and(eq(tickets.organizationId, orgId), isNotNull(tickets.parentId)))
      .groupBy(tickets.parentId),
  ])

  const names = new Map(clientRows.map((row) => [row.id, row.name]))
  const projectNames = new Map(projectRows.map((row) => [row.id, row.name]))
  const subtaskCounts = new Map(
    childRows.flatMap((row) => (row.parentId === null ? [] : [[row.parentId, row.subtasks] as const])),
  )

  const enriched = ticketRows.map(toTicket).map((ticket) => ({
    ...ticket,
    clientName: names.get(ticket.clientId) ?? ticket.clientId,
    projectName:
      ticket.projectId === undefined ? null : projectNames.get(ticket.projectId) ?? ticket.projectId,
    subtaskCount: subtaskCounts.get(ticket.id) ?? 0,
    isOverdue: isOverdueTicket(ticket, today, "done"),
  }))
  const items: TicketListItem[] = await attachTicketAssignees(
    { orgId, actor: { type: "system" } },
    enriched,
  )

  return { items, total: items.length, page: 1, pageSize: items.length }
}
