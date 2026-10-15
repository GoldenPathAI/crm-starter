import { and, arrayOverlaps, asc, count, eq, inArray } from "drizzle-orm"
import { resolveDbc, withTx } from "@/lib/crm/store/db"
import { activities, clients, deals, documents, people, projects, tickets } from "@/lib/db/schema/crm"
import { createId } from "@/lib/ids"
import { toActivity, toClient, toDeal, toProject, toTicket } from "@/lib/crm/store/mappers"
import { defaultPersonKind } from "@/lib/crm/store/people"
import {
  byDirection,
  isActiveProject,
  isOpenDeal,
  isOverdueTicket,
} from "@/lib/crm/store/predicates"
import { getPeopleByClientId, getPeopleByClientIds } from "@/lib/crm/store/people"
import { getDocumentsByClientId } from "@/lib/crm/store/documents"
import { attachTicketAssignees } from "@/lib/crm/store/assignees"
import { userNamesByIds } from "@/lib/crm/store/members"
import { assertValidValue, loadOrgEnums } from "@/lib/crm/enums/service"
import { todayIso } from "@/lib/dates"
import { config } from "@/lib/config"
import type { Paginated, SortOption } from "@/core/types/query.types"
import type {
  Activity,
  Client,
  ClientStatus,
  Deal,
  Doc,
  OrgScope,
  Person,
  Project,
  ServiceKind,
  TicketWithAssignees,
} from "@/core/types/crm.types"

const actorUserId = (scope: OrgScope): string | null =>
  scope.actor.type === "user" ? scope.actor.userId : null

// Labels are free-form and org-scoped. Store them trimmed, lowercased and de-duped so
// filtering and grouping treat "VIP" and "vip" as one label.
const normalizeLabels = (labels: string[]): string[] => [
  ...new Set(labels.map((label) => label.trim().toLowerCase()).filter((label) => label.length > 0)),
]

export interface ClientListItem extends Client {
  openPipelineCzk: number
  activeProjectsCount: number
  overdueTicketsCount: number
  primaryPerson: Person | null
}

export type ClientSortField = "name" | "mrr" | "lastContactAt" | "pipeline"
export type ClientGroupField = "status" | "service" | "industry"

export interface ClientListFilters {
  statuses?: ClientStatus[]
  services?: ServiceKind[]
  industries?: string[]
  labels?: string[]
  q?: string
}

export interface ClientListQuery {
  filters: ClientListFilters
  sort?: SortOption<ClientSortField>
  group?: ClientGroupField
  page: number
  pageSize?: number
}

export interface ClientDetail {
  client: Client
  people: Person[]
  deals: Deal[]
  projects: Project[]
  tickets: TicketWithAssignees[]
  activities: Activity[]
  documents: Doc[]
}

const compareClients = (
  a: ClientListItem,
  b: ClientListItem,
  sort: SortOption<ClientSortField> | undefined,
): number => {
  if (sort === undefined) {
    return a.name.localeCompare(b.name, "cs")
  }

  if (sort.field === "name") {
    return byDirection(a.name.localeCompare(b.name, "cs"), sort.direction)
  }

  if (sort.field === "mrr") {
    return byDirection((a.mrrCzk ?? 0) - (b.mrrCzk ?? 0), sort.direction)
  }

  if (sort.field === "pipeline") {
    return byDirection(a.openPipelineCzk - b.openPipelineCzk, sort.direction)
  }

  const aContact = a.lastContactAt ?? ""
  const bContact = b.lastContactAt ?? ""

  return byDirection(aContact.localeCompare(bContact), sort.direction)
}

export async function listClients(
  scope: OrgScope,
  query: ClientListQuery,
): Promise<Paginated<ClientListItem>> {
  const { filters } = query
  const today = todayIso()
  const dbc = resolveDbc(scope)

  const enums = await loadOrgEnums(scope.orgId)
  const closedDealStageValues = enums.deal_stage
    .filter((option) => option.semantic === "won" || option.semantic === "lost")
    .map((option) => option.value)
  const inactiveProjectStatusValues = enums.project_status
    .filter((option) => option.semantic === "done" || option.semantic === "paused")
    .map((option) => option.value)
  const doneTicketStatus = enums.ticket_status.find((option) => option.semantic === "done")
  if (doneTicketStatus === undefined) {
    throw new Error("Číselník ticket_status nemá hodnotu se semantikou done.")
  }

  const conditions = [eq(clients.organizationId, scope.orgId)]
  if (filters.statuses !== undefined) {
    conditions.push(inArray(clients.status, filters.statuses))
  }

  if (filters.industries !== undefined) {
    conditions.push(inArray(clients.industry, filters.industries))
  }

  if (filters.services !== undefined) {
    conditions.push(arrayOverlaps(clients.services, filters.services))
  }

  if (filters.labels !== undefined) {
    conditions.push(arrayOverlaps(clients.labels, filters.labels))
  }

  const clientRows = await dbc
    .select()
    .from(clients)
    .where(and(...conditions))
    .orderBy(asc(clients.id))
  const baseClients = clientRows.map(toClient)
  const ids = baseClients.map((client) => client.id)

  const [peopleAll, dealRows, projectRows, ticketRows] = await Promise.all([
    getPeopleByClientIds(scope, ids),
    ids.length > 0
      ? dbc
          .select()
          .from(deals)
          .where(and(inArray(deals.clientId, ids), eq(deals.organizationId, scope.orgId)))
      : Promise.resolve([]),
    ids.length > 0
      ? dbc
          .select()
          .from(projects)
          .where(and(inArray(projects.clientId, ids), eq(projects.organizationId, scope.orgId)))
      : Promise.resolve([]),
    ids.length > 0
      ? dbc
          .select()
          .from(tickets)
          .where(and(inArray(tickets.clientId, ids), eq(tickets.organizationId, scope.orgId)))
      : Promise.resolve([]),
  ])
  const dealsAll = dealRows.map(toDeal)
  const projectsAll = projectRows.map(toProject)
  const ticketsAll = ticketRows.map(toTicket)

  const primaryPersonOf = (clientId: string): Person | null => {
    const list = peopleAll.filter((person) => person.clientId === clientId)

    return list.find((person) => person.isPrimary) ?? list[0] ?? null
  }

  const enrichClient = (client: Client): ClientListItem => ({
    ...client,
    openPipelineCzk: dealsAll
      .filter((deal) => deal.clientId === client.id && isOpenDeal(deal, closedDealStageValues))
      .reduce((sum, deal) => sum + deal.valueCzk, 0),
    activeProjectsCount: projectsAll.filter(
      (project) =>
        project.clientId === client.id && isActiveProject(project, inactiveProjectStatusValues),
    ).length,
    overdueTicketsCount: ticketsAll.filter(
      (ticket) => ticket.clientId === client.id && isOverdueTicket(ticket, today, doneTicketStatus.value),
    ).length,
    primaryPerson: primaryPersonOf(client.id),
  })

  const clientHaystack = (client: Client): string => {
    const peopleNames = peopleAll
      .filter((person) => person.clientId === client.id)
      .map((person) => person.name)

    return [
      client.name,
      client.industry,
      client.city ?? "",
      client.nextStep ?? "",
      ...peopleNames,
    ]
      .join(" ")
      .toLowerCase()
  }

  const q = filters.q?.toLowerCase()
  const filtered = baseClients
    .filter((client) => {
      if (q !== undefined && q.length > 0 && !clientHaystack(client).includes(q)) {
        return false
      }

      return true
    })
    .map((client) => enrichClient(client))
    .sort((a, b) => compareClients(a, b, query.sort))

  const total = filtered.length
  if (query.group !== undefined) {
    return { items: filtered, total, page: 1, pageSize: total }
  }

  const pageSize = query.pageSize ?? config.defaultPageSize
  const page = Math.max(1, query.page)
  const start = (page - 1) * pageSize

  return { items: filtered.slice(start, start + pageSize), total, page, pageSize }
}

export async function getClient(scope: OrgScope, id: string): Promise<ClientDetail | null> {
  const dbc = resolveDbc(scope)
  const clientRows = await dbc
    .select()
    .from(clients)
    .where(and(eq(clients.id, id), eq(clients.organizationId, scope.orgId)))
    .limit(1)
  const clientRow = clientRows[0]
  if (clientRow === undefined) {
    return null
  }

  const [peopleList, dealRows, projectRows, ticketRows, activityRows, docList] = await Promise.all([
    getPeopleByClientId(scope, id),
    dbc
      .select()
      .from(deals)
      .where(and(eq(deals.clientId, id), eq(deals.organizationId, scope.orgId)))
      .orderBy(asc(deals.id)),
    dbc
      .select()
      .from(projects)
      .where(and(eq(projects.clientId, id), eq(projects.organizationId, scope.orgId)))
      .orderBy(asc(projects.id)),
    dbc
      .select()
      .from(tickets)
      .where(and(eq(tickets.clientId, id), eq(tickets.organizationId, scope.orgId)))
      .orderBy(asc(tickets.id)),
    dbc
      .select()
      .from(activities)
      .where(and(eq(activities.clientId, id), eq(activities.organizationId, scope.orgId)))
      .orderBy(asc(activities.id)),
    getDocumentsByClientId(scope, id),
  ])

  const activityList = activityRows.map(toActivity)
  const actorNames = await userNamesByIds(
    activityList.flatMap((activity) =>
      activity.actorUserId !== undefined ? [activity.actorUserId] : [],
    ),
  )
  const hydratedActivities = activityList
    .map((activity) => ({
      ...activity,
      actorName:
        activity.actorUserId !== undefined ? actorNames.get(activity.actorUserId) : undefined,
    }))
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))

  const ticketList = ticketRows.map(toTicket).sort((a, b) => a.order - b.order)

  return {
    client: toClient(clientRow),
    people: peopleList,
    deals: dealRows.map(toDeal).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    projects: projectRows.map(toProject),
    tickets: await attachTicketAssignees(scope, ticketList),
    activities: hydratedActivities,
    documents: docList.sort((a, b) => b.id.localeCompare(a.id)),
  }
}

export interface ClientContactInput {
  name: string
  role?: string
  email?: string
  phone?: string
}

export interface CreateClientInput {
  name: string
  industry: string
  street?: string
  city?: string
  zip?: string
  ico?: string
  dic?: string
  website?: string
  status: ClientStatus
  services: ServiceKind[]
  billingEmail?: string
  mrrCzk?: number
  nextStep?: string
  note?: string
  labels?: string[]
  primaryContact?: ClientContactInput
}

// A provided key updates the column, an absent key leaves it. `null` clears a
// nullable column, a string sets it. This lets the full edit dialog and the
// single-field inline pencils share one mutation.
export interface UpdateClientPatch {
  name?: string
  industry?: string
  street?: string | null
  city?: string | null
  zip?: string | null
  ico?: string | null
  dic?: string | null
  website?: string | null
  status?: ClientStatus
  services?: ServiceKind[]
  billingEmail?: string | null
  mrrCzk?: number | null
  nextStep?: string | null
  note?: string | null
  labels?: string[]
}

export interface DeleteClientResult {
  deleted: boolean
}

const assertClientEnums = async (
  orgId: string,
  status: ClientStatus,
  services: ServiceKind[],
): Promise<void> => {
  await assertValidValue(orgId, "client_status", status)
  for (const service of services) {
    await assertValidValue(orgId, "service_kind", service)
  }
}

export async function createClient(scope: OrgScope, input: CreateClientInput): Promise<Client> {
  await assertClientEnums(scope.orgId, input.status, input.services)
  const contactKind = await defaultPersonKind(scope.orgId, true)
  const clientId = createId("cl")
  const createdByUserId = actorUserId(scope)
  const dbc = resolveDbc(scope)
  const created = await withTx(dbc, async (tx) => {
    const inserted = await tx
      .insert(clients)
      .values({
        id: clientId,
        organizationId: scope.orgId,
        name: input.name,
        ico: input.ico ?? null,
        dic: input.dic ?? null,
        website: input.website ?? null,
        industry: input.industry,
        street: input.street ?? null,
        city: input.city ?? null,
        zip: input.zip ?? null,
        status: input.status,
        services: input.services,
        billingEmail: input.billingEmail ?? null,
        mrrCzk: input.mrrCzk ?? null,
        nextStep: input.nextStep ?? null,
        note: input.note ?? null,
        labels: normalizeLabels(input.labels ?? []),
        createdByUserId,
      })
      .returning()
    const clientRow = inserted[0]
    if (clientRow === undefined) {
      throw new Error("Klienta se nepodařilo vytvořit.")
    }

    const contact = input.primaryContact
    let personId: string | null = null
    if (contact !== undefined && contact.name.trim().length > 0) {
      personId = createId("pe")
      await tx.insert(people).values({
        id: personId,
        organizationId: scope.orgId,
        clientId,
        name: contact.name,
        kind: contactKind,
        role: contact.role ?? null,
        email: contact.email ?? null,
        phone: contact.phone ?? null,
        isPrimary: true,
        createdByUserId,
      })
    }

    return { clientRow, personId }
  })

  return toClient(created.clientRow)
}

export async function updateClient(
  scope: OrgScope,
  id: string,
  patch: UpdateClientPatch,
): Promise<Client> {
  if (patch.status !== undefined) {
    await assertValidValue(scope.orgId, "client_status", patch.status)
  }

  if (patch.services !== undefined) {
    for (const service of patch.services) {
      await assertValidValue(scope.orgId, "service_kind", service)
    }
  }

  const setValues: Partial<typeof clients.$inferInsert> = {
    ...(patch.name !== undefined ? { name: patch.name } : {}),
    ...(patch.industry !== undefined ? { industry: patch.industry } : {}),
    ...(patch.street !== undefined ? { street: patch.street } : {}),
    ...(patch.city !== undefined ? { city: patch.city } : {}),
    ...(patch.zip !== undefined ? { zip: patch.zip } : {}),
    ...(patch.ico !== undefined ? { ico: patch.ico } : {}),
    ...(patch.dic !== undefined ? { dic: patch.dic } : {}),
    ...(patch.website !== undefined ? { website: patch.website } : {}),
    ...(patch.status !== undefined ? { status: patch.status } : {}),
    ...(patch.services !== undefined ? { services: patch.services } : {}),
    ...(patch.billingEmail !== undefined ? { billingEmail: patch.billingEmail } : {}),
    ...(patch.mrrCzk !== undefined ? { mrrCzk: patch.mrrCzk } : {}),
    ...(patch.nextStep !== undefined ? { nextStep: patch.nextStep } : {}),
    ...(patch.note !== undefined ? { note: patch.note } : {}),
    ...(patch.labels !== undefined ? { labels: normalizeLabels(patch.labels) } : {}),
    updatedAt: new Date(),
  }

  const dbc = resolveDbc(scope)
  const rows = await dbc
    .update(clients)
    .set(setValues)
    .where(and(eq(clients.id, id), eq(clients.organizationId, scope.orgId)))
    .returning()
  const row = rows[0]
  if (row === undefined) {
    throw new Error("Klient nebyl nalezen.")
  }

  return toClient(row)
}

// Hard delete is only allowed when the client has no deals, projects, tickets
// or documents. People and activities cascade via FK. Callers with related
// rows must archive the client instead (status -> ukonceny).
export async function deleteClient(scope: OrgScope, id: string): Promise<DeleteClientResult> {
  const dbc = resolveDbc(scope)

  return withTx(dbc, async (tx) => {
    const existing = await tx
      .select({ id: clients.id })
      .from(clients)
      .where(and(eq(clients.id, id), eq(clients.organizationId, scope.orgId)))
      .limit(1)
    if (existing[0] === undefined) {
      throw new Error("Klient nebyl nalezen.")
    }

    const dealCount = await tx
      .select({ value: count() })
      .from(deals)
      .where(and(eq(deals.clientId, id), eq(deals.organizationId, scope.orgId)))
    const projectCount = await tx
      .select({ value: count() })
      .from(projects)
      .where(and(eq(projects.clientId, id), eq(projects.organizationId, scope.orgId)))
    const ticketCount = await tx
      .select({ value: count() })
      .from(tickets)
      .where(and(eq(tickets.clientId, id), eq(tickets.organizationId, scope.orgId)))
    const documentCount = await tx
      .select({ value: count() })
      .from(documents)
      .where(and(eq(documents.clientId, id), eq(documents.organizationId, scope.orgId)))

    const related =
      (dealCount[0]?.value ?? 0) +
      (projectCount[0]?.value ?? 0) +
      (ticketCount[0]?.value ?? 0) +
      (documentCount[0]?.value ?? 0)
    if (related > 0) {
      throw new Error(
        "Klient má navázané dealy, projekty, úkoly nebo dokumenty. Místo smazání ukonči spolupráci.",
      )
    }

    await tx.delete(clients).where(and(eq(clients.id, id), eq(clients.organizationId, scope.orgId)))

    return { deleted: true }
  })
}
