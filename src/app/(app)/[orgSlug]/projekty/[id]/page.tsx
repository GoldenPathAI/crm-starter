import Link from "next/link"
import { notFound } from "next/navigation"
import { ChevronRight } from "lucide-react"
import { getProject } from "@/lib/crm/store/projects"
import { listClients } from "@/lib/crm/store/clients"
import { requireOrgContext } from "@/lib/auth/orgContext"
import { listAuditForEntity } from "@/lib/crm/audit/queries"
import { buildHistoryItems, HistoryCard } from "@/app/_components/HistoryCard"
import { loadOrgEnums } from "@/lib/crm/enums/service"
import { orgHref } from "@/lib/nav"
import { todayIso } from "@/lib/dates"
import { formatCzechDate } from "@/lib/dates"
import { cn } from "@/lib/cn"
import type { FormSelectOption } from "../_components/types"
import { TicketBoard } from "./_components/TicketBoard"
import { ProjectActions } from "./_components/ProjectActions"
import { ProjectStatusMenu } from "./_components/ProjectStatusMenu"
import { CompleteProjectButton } from "./_components/CompleteProjectButton"
import { formatCzk } from "@/lib/money"

export const dynamic = "force-dynamic"

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ orgSlug: string; id: string }>
}) {
  const { orgSlug, id } = await params
  const ctx = await requireOrgContext(orgSlug)
  const detail = await getProject(ctx.scope, id)
  if (detail === null) {
    notFound()
  }

  const { project, client, tickets } = detail
  const enums = await loadOrgEnums(ctx.scope.orgId)
  const ticketStatusOptions = enums.ticket_status
  const priorityOptions = enums.ticket_priority
  const projectStatusOptions = enums.project_status
  const ticketDoneValue = ticketStatusOptions.find((option) => option.semantic === "done")?.value ?? ""
  const backlogValue =
    ticketStatusOptions.find((option) => option.semantic === "backlog")?.value ??
    ticketStatusOptions[0]?.value ??
    ""
  const projectDoneValue = projectStatusOptions.find((option) => option.semantic === "done")?.value ?? ""
  const { items: clients } = await listClients(ctx.scope, {
    filters: {},
    page: 1,
    group: "status",
  })
  const clientOptions: FormSelectOption[] = clients
    .map((entry) => ({ value: entry.id, label: entry.name }))
    .sort((a, b) => a.label.localeCompare(b.label, "cs"))
  const history = buildHistoryItems(
    await listAuditForEntity(
      ctx.scope.orgId,
      { tableName: "projects", rowId: project.id, fkColumn: "project_id" },
      8,
    ),
  )
  const today = todayIso()
  const total = tickets.length
  const done = tickets.filter((ticket) => ticket.status === ticketDoneValue).length
  const overdueTickets = tickets.filter(
    (ticket) => ticket.status !== ticketDoneValue && ticket.dueAt !== undefined && ticket.dueAt < today,
  ).length
  const ratio = total > 0 ? done / total : 0
  const overdue =
    project.dueAt !== undefined && project.status !== projectDoneValue && project.dueAt < today

  const canComplete = projectDoneValue.length > 0 && project.status !== projectDoneValue

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <nav className="flex items-center gap-1 text-xs text-muted">
          <Link href={orgHref(ctx.org.slug, "/projekty")} className="transition-colors hover:text-foreground">
            Projekty
          </Link>
          <ChevronRight className="size-3 text-muted-soft" />
          <span className="text-muted-soft">{project.name}</span>
        </nav>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="font-display text-[28px] font-semibold tracking-tight text-foreground">
              {project.name}
            </h1>
            <Link
              href={orgHref(ctx.org.slug, `/klienti/${client.id}`)}
              className="mt-1 inline-block text-[15px] text-muted transition-colors hover:text-primary"
            >
              {client.name}
            </Link>
          </div>
          <div className="flex items-center gap-3">
            {canComplete ? (
              <CompleteProjectButton projectId={project.id} doneStatus={projectDoneValue} />
            ) : null}
            <ProjectStatusMenu project={project} statusOptions={projectStatusOptions} />
            <ProjectActions
              project={project}
              clientOptions={clientOptions}
              statusOptions={projectStatusOptions}
              ticketCount={total}
            />
          </div>
        </div>

        {project.description !== undefined ? (
          <p className="max-w-2xl text-[15px] leading-relaxed text-muted">{project.description}</p>
        ) : null}

        <div className="flex flex-wrap items-center gap-x-8 gap-y-3 rounded-2xl border border-hairline bg-surface px-5 py-4 shadow-soft">
          {project.startedAt !== undefined ? (
            <MetaItem label="Zahájení">
              <span className="tabular-nums">{formatCzechDate(project.startedAt)}</span>
            </MetaItem>
          ) : null}
          <MetaItem label="Termín">
            {project.dueAt !== undefined ? (
              <span className={cn("tabular-nums", overdue && "font-medium text-red-text")}>
                {formatCzechDate(project.dueAt)}
              </span>
            ) : (
              <span className="text-muted-soft">-</span>
            )}
          </MetaItem>
          <MetaItem label="Budget">
            <span className="tabular-nums">
              {project.budgetCzk !== undefined ? formatCzk(project.budgetCzk) : "-"}
            </span>
          </MetaItem>
          <MetaItem label="Hotové úkoly">
            <div className="flex items-center gap-2.5">
              <span className="tabular-nums">
                {done}/{total}
              </span>
              <span className="h-1.5 w-28 overflow-hidden rounded-full bg-surface-3/70">
                <span
                  className="block h-full rounded-full bg-primary"
                  style={{ width: `${Math.round(ratio * 100)}%` }}
                />
              </span>
              {overdueTickets > 0 ? (
                <span className="inline-flex items-center whitespace-nowrap rounded-full bg-red-soft px-2 py-0.5 text-[11px] font-medium tabular-nums text-red-text">
                  {overdueTickets} po termínu
                </span>
              ) : null}
            </div>
          </MetaItem>
        </div>
      </div>

      <TicketBoard
        projectId={project.id}
        tickets={tickets}
        statusOptions={ticketStatusOptions}
        priorityOptions={priorityOptions}
        doneValue={ticketDoneValue}
        backlogValue={backlogValue}
      />

      <div className="max-w-xl">
        <HistoryCard items={history} historyHref={orgHref(ctx.org.slug, "/nastaveni?tab=historie")} />
      </div>
    </div>
  )
}

function MetaItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted-soft">
        {label}
      </span>
      <span className="text-sm text-foreground">{children}</span>
    </div>
  )
}
