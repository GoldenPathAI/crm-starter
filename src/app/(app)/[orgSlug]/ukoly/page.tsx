import { endOfWeek, format } from "date-fns"
import { PageHeader } from "@/app/_ui/PageHeader"
import { PageShell } from "@/app/_ui/PageShell"
import { listTickets } from "@/lib/crm/queries"
import { listOrgMembers } from "@/lib/crm/store/members"
import { requireOrgContext } from "@/lib/auth/org-context"
import { applyDefaultSavedView } from "@/app/_lib/defaultView"
import { loadOrgEnums } from "@/lib/crm/enums/service"
import { todayIso } from "@/lib/dates"
import { parsePageSize } from "@/lib/pageSize"
import { SortDirection } from "@/core/types/query.types"
import type { TicketListItem } from "@/lib/crm/queries"
import { parseTicketQuery, TICKET_VIEWS, type TicketView } from "./_lib/parseTicketQuery"
import { TicketsTable } from "./_components/TicketsTable"
import { NewTicketButton } from "./_components/NewTicketButton"

export const dynamic = "force-dynamic"

type SearchParams = Record<string, string | string[] | undefined>

const matchesView = (
  ticket: TicketListItem,
  view: TicketView,
  today: string,
  weekEnd: string,
  doneValue: string,
): boolean => {
  switch (view) {
    case "otevrene":
      return ticket.status !== doneValue
    case "po-terminu":
      return ticket.isOverdue
    case "dnes":
      return ticket.status !== doneValue && ticket.dueAt === today
    case "tyden":
      return (
        ticket.status !== doneValue &&
        ticket.dueAt !== undefined &&
        ticket.dueAt >= today &&
        ticket.dueAt <= weekEnd
      )
    case "bez-terminu":
      return ticket.status !== doneValue && ticket.dueAt === undefined
    case "hotove":
      return ticket.status === doneValue
  }
}

export default async function UkolyPage({
  searchParams,
  params,
}: {
  searchParams: Promise<SearchParams>
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params
  const ctx = await requireOrgContext(orgSlug)
  await applyDefaultSavedView(ctx, orgSlug, "ukoly", await searchParams)
  const enums = await loadOrgEnums(ctx.scope.orgId)
  const statusOptions = enums.ticket_status
  const priorityOptions = enums.ticket_priority
  const priorityValues = priorityOptions.map((option) => option.value)
  const doneValue = statusOptions.find((option) => option.semantic === "done")?.value ?? ""

  const searchParamsValue = await searchParams
  const state = parseTicketQuery(
    searchParamsValue,
    statusOptions.map((option) => option.value),
    priorityValues,
  )

  const [all, members] = await Promise.all([
    listTickets(ctx.scope, { filters: {}, page: 1, group: "client" }),
    listOrgMembers(ctx.scope.orgId),
  ])

  // The column filter only lists clients that already have a task.
  const filterClientOptions = [
    ...new Map(all.items.map((ticket) => [ticket.clientId, ticket.clientName])),
  ]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label, "cs"))

  const assigneeOptions = members
    .map((member) => ({ value: member.userId, label: member.name }))
    .sort((a, b) => a.label.localeCompare(b.label, "cs"))

  const today = todayIso()
  const weekEnd = format(endOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd")

  const priorityRank = (priority: string): number => {
    const index = priorityValues.indexOf(priority)
    return index === -1 ? priorityValues.length : index
  }

  // Secondary refinements (status/priority/client/search) narrow the pool the
  // view counts and the active view are computed over, so a client filter makes
  // "Po termínu 2" mean overdue for that client, not globally.
  const needle = state.q.toLowerCase()
  const scoped = all.items
    .filter((ticket) => (state.statuses.length > 0 ? state.statuses.includes(ticket.status) : true))
    .filter((ticket) => (state.priorities.length > 0 ? state.priorities.includes(ticket.priority) : true))
    .filter((ticket) => (state.clientIds.length > 0 ? state.clientIds.includes(ticket.clientId) : true))
    .filter((ticket) =>
      state.assigneeIds.length > 0
        ? ticket.assignees.some((assignee) => state.assigneeIds.includes(assignee.userId))
        : true,
    )
    .filter((ticket) =>
      needle.length > 0
        ? `${ticket.title} ${ticket.clientName} ${ticket.projectName ?? ""}`.toLowerCase().includes(needle)
        : true,
    )

  const viewCounts = TICKET_VIEWS.reduce(
    (counts, view) => {
      counts[view] = scoped.filter((ticket) => matchesView(ticket, view, today, weekEnd, doneValue)).length
      return counts
    },
    {} as Record<TicketView, number>,
  )

  const factor = state.sortDir === SortDirection.Desc ? -1 : 1
  const effectiveField = state.sortField ?? "due"
  const sorted = scoped
    .filter((ticket) => matchesView(ticket, state.view, today, weekEnd, doneValue))
    .sort((a, b) => {
      if (state.sortField === undefined && state.view === "hotove") {
        return (b.doneAt ?? "").localeCompare(a.doneAt ?? "")
      }
      if (effectiveField === "title") {
        return factor * a.title.localeCompare(b.title, "cs")
      }
      if (effectiveField === "priority") {
        return factor * (priorityRank(a.priority) - priorityRank(b.priority))
      }
      return factor * (a.dueAt ?? "9999-99-99").localeCompare(b.dueAt ?? "9999-99-99")
    })

  const total = sorted.length
  const page = Math.max(1, state.page)
  const pageSize = parsePageSize(searchParamsValue.pageSize)
  const grouped = state.groups.length > 0
  const rows = grouped ? sorted : sorted.slice((page - 1) * pageSize, (page - 1) * pageSize + pageSize)

  return (
    <PageShell wide className="gap-8">
      <PageHeader
        title="Úkoly"
        description="Úkoly napříč všemi klienty"
        actions={<NewTicketButton />}
      />
      <TicketsTable
        rows={rows}
        total={total}
        page={page}
        pageSize={pageSize}
        clientOptions={filterClientOptions}
        assigneeOptions={assigneeOptions}
        members={members}
        statusOptions={statusOptions}
        priorityOptions={priorityOptions}
        doneValue={doneValue}
        state={state}
        viewCounts={viewCounts}
        today={today}
      />
    </PageShell>
  )
}
