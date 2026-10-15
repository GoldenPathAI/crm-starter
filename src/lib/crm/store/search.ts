import { and, desc, eq, ilike, inArray, isNull, or } from "drizzle-orm"
import { resolveDbc } from "@/lib/crm/store/db"
import { activities, clients, deals, projects, tickets } from "@/lib/db/schema/crm"
import { loadOrgEnums } from "@/lib/crm/enums/service"
import type { OrgScope } from "@/core/types/crm.types"

// Part of the /search API response and the CLI output.
export const SEARCH_RESULT_TYPES = ["client", "deal", "project", "ticket", "email"] as const

export type SearchResultType = (typeof SEARCH_RESULT_TYPES)[number]

export interface SearchResult {
  type: SearchResultType
  id: string
  title: string
  subtitle: string | null
  href: string
  // Only e-mail hits carry a matched-body excerpt; the palette renders it as a
  // second muted line under the subject. Absent for every other result type.
  excerpt?: string
}

// A ~maxLength window of `body` centered on the first case-insensitive occurrence
// of `query`, with an ellipsis on each cut edge. When the query is not in the body
// (the match was in the subject) it returns the head of the body instead. Whitespace
// is collapsed first so a wrapped e-mail excerpt stays on one readable line.
export function buildMatchExcerpt(body: string, query: string, maxLength = 120): string {
  const normalized = body.replace(/\s+/g, " ").trim()
  if (normalized.length <= maxLength) {
    return normalized
  }

  const matchIndex = normalized.toLowerCase().indexOf(query.toLowerCase())
  if (matchIndex < 0) {
    return `${normalized.slice(0, maxLength).trimEnd()}…`
  }

  const pad = Math.floor((maxLength - Math.min(query.length, maxLength)) / 2)
  const end = Math.min(normalized.length, Math.max(matchIndex + query.length, matchIndex + pad) + pad)
  const start = Math.max(0, end - maxLength)
  const slice = normalized.slice(start, end).trim()
  const prefix = start > 0 ? "…" : ""
  const suffix = end < normalized.length ? "…" : ""

  return `${prefix}${slice}${suffix}`
}

const shortDate = (value: Date): string =>
  new Intl.DateTimeFormat("cs-CZ", { day: "numeric", month: "numeric", year: "numeric" }).format(
    value,
  )

// Global command-palette search. Clients, deals, projects and tickets by
// name/title with a case-insensitive substring match, capped per type so one
// crowded category never buries the others. Deals and tickets have no dedicated
// route, so they deep-link to the surface that actually renders them (the client
// folder and the project board).
const PER_TYPE_LIMIT = 5

const joinSubtitle = (parts: Array<string | null>): string | null => {
  const clean = parts.filter((part): part is string => part !== null && part.length > 0)

  return clean.length > 0 ? clean.join(" · ") : null
}

export async function searchEntities(scope: OrgScope, rawQuery: string): Promise<SearchResult[]> {
  const q = rawQuery.trim()
  if (q.length < 2) {
    return []
  }

  const pattern = `%${q}%`
  const dbc = resolveDbc(scope)

  // Loaded first because the e-mail query filters on the org's email_in/email_out
  // values and the direction label is derived from the same semantics. loadOrgEnums
  // is request-cached, so this is not an extra round-trip in practice.
  const enums = await loadOrgEnums(scope.orgId)
  const emailOptions = enums.activity_type.filter(
    (option) => option.semantic === "email_in" || option.semantic === "email_out",
  )
  const emailValues = emailOptions.map((option) => option.value)
  const outboundValues = new Set(
    emailOptions.filter((option) => option.semantic === "email_out").map((option) => option.value),
  )

  const [clientRows, dealRows, projectRows, ticketRows, emailRows] = await Promise.all([
    dbc
      .select({
        id: clients.id,
        name: clients.name,
        industry: clients.industry,
        city: clients.city,
      })
      .from(clients)
      .where(
        and(
          eq(clients.organizationId, scope.orgId),
          or(
            ilike(clients.name, pattern),
            ilike(clients.industry, pattern),
            ilike(clients.city, pattern),
          ),
        ),
      )
      .limit(PER_TYPE_LIMIT),
    dbc
      .select({
        id: deals.id,
        title: deals.title,
        stage: deals.stage,
        clientId: deals.clientId,
        clientName: clients.name,
      })
      .from(deals)
      .leftJoin(clients, eq(deals.clientId, clients.id))
      .where(and(eq(deals.organizationId, scope.orgId), ilike(deals.title, pattern)))
      .limit(PER_TYPE_LIMIT),
    dbc
      .select({
        id: projects.id,
        name: projects.name,
        clientName: clients.name,
      })
      .from(projects)
      .leftJoin(clients, eq(projects.clientId, clients.id))
      .where(and(eq(projects.organizationId, scope.orgId), ilike(projects.name, pattern)))
      .limit(PER_TYPE_LIMIT),
    dbc
      .select({
        id: tickets.id,
        title: tickets.title,
        clientId: tickets.clientId,
        projectId: tickets.projectId,
        clientName: clients.name,
        projectName: projects.name,
      })
      .from(tickets)
      .leftJoin(clients, eq(tickets.clientId, clients.id))
      .leftJoin(projects, eq(tickets.projectId, projects.id))
      .where(
        and(
          eq(tickets.organizationId, scope.orgId),
          isNull(tickets.parentId),
          ilike(tickets.title, pattern),
        ),
      )
      .limit(PER_TYPE_LIMIT),
    emailValues.length === 0
      ? Promise.resolve([])
      : dbc
          .select({
            id: activities.id,
            title: activities.title,
            body: activities.body,
            type: activities.type,
            occurredAt: activities.occurredAt,
            clientId: activities.clientId,
            clientName: clients.name,
          })
          .from(activities)
          .innerJoin(clients, eq(activities.clientId, clients.id))
          .where(
            and(
              eq(activities.organizationId, scope.orgId),
              inArray(activities.type, emailValues),
              or(ilike(activities.title, pattern), ilike(activities.body, pattern)),
            ),
          )
          .orderBy(desc(activities.occurredAt))
          .limit(PER_TYPE_LIMIT),
  ])

  const stageLabels = new Map(enums.deal_stage.map((option) => [option.value, option.label]))

  const clientResults: SearchResult[] = clientRows.map((row) => ({
    type: "client",
    id: row.id,
    title: row.name,
    subtitle: joinSubtitle([row.industry, row.city]),
    href: `/klienti/${row.id}`,
  }))

  const projectResults: SearchResult[] = projectRows.map((row) => ({
    type: "project",
    id: row.id,
    title: row.name,
    subtitle: row.clientName,
    href: `/projekty/${row.id}`,
  }))

  const ticketResults: SearchResult[] = ticketRows.map((row) => ({
    type: "ticket",
    id: row.id,
    title: row.title,
    subtitle: joinSubtitle([row.clientName, row.projectName]),
    href: row.projectId !== null ? `/projekty/${row.projectId}` : `/klienti/${row.clientId}`,
  }))

  const dealResults: SearchResult[] = dealRows.map((row) => ({
    type: "deal",
    id: row.id,
    title: row.title,
    subtitle: joinSubtitle([row.clientName, stageLabels.get(row.stage) ?? row.stage]),
    href: `/klienti/${row.clientId}`,
  }))

  const emailResults: SearchResult[] = emailRows.map((row) => {
    const directionLabel = outboundValues.has(row.type) ? "Odesláno" : "Přijato"

    return {
      type: "email",
      id: row.id,
      title: row.title,
      subtitle: joinSubtitle([directionLabel, row.clientName, shortDate(row.occurredAt)]),
      href: `/klienti/${row.clientId}?tab=aktivita`,
      excerpt: buildMatchExcerpt(row.body ?? row.title, q),
    }
  })

  return [
    ...clientResults,
    ...projectResults,
    ...ticketResults,
    ...dealResults,
    ...emailResults,
  ]
}
