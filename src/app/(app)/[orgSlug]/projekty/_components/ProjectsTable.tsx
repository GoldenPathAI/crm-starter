"use client"

import { FolderKanban } from "lucide-react"
import { Browser } from "@/app/_components/browser/Browser"
import type {
  BrowserColumn,
  BrowserFilterOption,
  BrowserGroupConfig,
} from "@/app/_components/browser/types"
import { badgeStyleFor, optionBadgeStyle, styleMap, type BadgeStyle } from "@/lib/crm/config"
import { todayIso } from "@/lib/dates"
import { formatCzechDate } from "@/lib/dates"
import { cn } from "@/lib/cn"
import type { SortDirection } from "@/core/types/query.types"
import type { EnumOption } from "@/core/types/crm.types"
import type { ProjectListItem } from "@/lib/crm/store/projects"
import { useOrg } from "@/app/_components/org/OrgProvider"
import { orgHref } from "@/lib/nav"
import { formatCzk } from "../_lib/format"
import type { ProjectGroupValue, ProjectSortField } from "../_lib/listQuery"

interface ProjectsTableProps {
  rows: ProjectListItem[]
  statuses: string[]
  statusOptions: EnumOption[]
  doneValue: string
  q: string
  sortField?: ProjectSortField
  sortDir: SortDirection
  // Active group levels as URL values, primary first; empty = ungrouped.
  groups: ProjectGroupValue[]
}

function buildGroups(rows: ProjectListItem[], urlValue: string, statusOptions: EnumOption[]) {
  if (urlValue === "status") {
    return statusOptions
      .map((option) => ({
        key: option.value,
        label: option.label,
        dotClassName: optionBadgeStyle(option).dot,
        rows: rows.filter((project) => project.status === option.value),
      }))
      .filter((bucket) => bucket.rows.length > 0)
  }

  const labels = new Map(rows.map((project) => [project.clientId, project.clientName]))
  const ids = [...new Set(rows.map((project) => project.clientId))]

  return ids
    .map((id) => ({
      key: id,
      label: labels.get(id) ?? id,
      rows: rows.filter((project) => project.clientId === id),
    }))
    .sort((a, b) => b.rows.length - a.rows.length)
}

export function ProjectsTable({
  rows,
  statuses,
  statusOptions,
  doneValue,
  q,
  sortField,
  sortDir,
  groups,
}: ProjectsTableProps) {
  const { orgSlug } = useOrg()

  const statusStyles = styleMap(statusOptions)

  const statusFilterOptions: BrowserFilterOption[] = statusOptions.map((option) => ({
    value: option.value,
    label: option.label,
    dotClassName: optionBadgeStyle(option).dot,
  }))

  const isOverdue = (project: ProjectListItem): boolean =>
    project.dueAt !== undefined && project.status !== doneValue && project.dueAt < todayIso()

  const columns: BrowserColumn<ProjectListItem>[] = [
    {
      id: "name",
      header: "Projekt",
      sortField: "name",
      cell: (project) => (
        <div className="flex flex-col gap-0.5">
          <span className="text-[13px] font-semibold text-foreground">{project.name}</span>
          <span className="w-fit text-xs text-muted">{project.clientName}</span>
        </div>
      ),
    },
    {
      id: "status",
      header: "Status",
      sortField: "status",
      filter: { kind: "checkbox", paramKey: "status", label: "Status", options: statusFilterOptions, selected: statuses },
      cell: (project) => <StatusPill style={badgeStyleFor(project.status, statusStyles)} />,
    },
    {
      id: "due",
      header: "Termín",
      sortField: "due",
      cellClassName: "tabular-nums text-[13px]",
      cell: (project) =>
        project.dueAt !== undefined ? (
          <span className={cn(isOverdue(project) ? "font-medium text-red-text" : "text-muted")}>
            {formatCzechDate(project.dueAt)}
          </span>
        ) : (
          <span className="text-muted-soft">-</span>
        ),
    },
    {
      id: "budget",
      header: "Budget",
      cellClassName: "tabular-nums text-[13px] text-muted",
      cell: (project) => (project.budgetCzk !== undefined ? formatCzk(project.budgetCzk) : "-"),
    },
    {
      id: "tickets",
      header: "Úkoly",
      cell: (project) => <TicketsProgress project={project} />,
    },
  ]

  const groupConfig: BrowserGroupConfig<ProjectListItem> = {
    current: groups,
    options: [
      { value: "status", label: "Stav" },
      { value: "klient", label: "Klient" },
    ],
    build: (list, urlValue) => buildGroups(list, urlValue, statusOptions),
    maxLevels: 2,
  }

  return (
    <Browser
      rows={rows}
      total={rows.length}
      page={1}
      pageSize={Math.max(rows.length, 1)}
      rowKey={(project) => project.id}
      columns={columns}
      sort={sortField !== undefined ? { field: sortField, direction: sortDir } : undefined}
      searchValue={q}
      searchPlaceholder="Hledat projekt nebo klienta"
      searchAriaLabel="Hledat projekt nebo klienta"
      group={groupConfig}
      rowHref={(project) => orgHref(orgSlug, `/projekty/${project.id}`)}
      empty={{
        icon: <FolderKanban className="size-6" />,
        title: "Žádné projekty",
        description: "Zatím tu nejsou žádné projekty.",
      }}
      emptyFiltered={{
        icon: <FolderKanban className="size-6" />,
        title: "Žádné výsledky",
        description: "Zadanému hledání ani filtrům neodpovídá žádný projekt.",
      }}
    />
  )
}

function TicketsProgress({ project }: { project: ProjectListItem }) {
  const total = project.ticketsTotal
  const done = project.ticketsDone
  const ratio = total > 0 ? done / total : 0

  return (
    <div className="flex items-center gap-2.5">
      <span className="w-10 shrink-0 text-right text-xs font-medium tabular-nums text-muted">
        {done}/{total}
      </span>
      <span className="h-1.5 w-24 overflow-hidden rounded-full bg-surface-3/70">
        <span
          className="block h-full rounded-full bg-primary transition-[width] duration-300"
          style={{ width: `${Math.round(ratio * 100)}%` }}
        />
      </span>
      {project.ticketsOverdue > 0 ? (
        <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-red-soft px-2 py-0.5 text-[11px] font-medium tabular-nums text-red-text">
          {project.ticketsOverdue} po termínu
        </span>
      ) : null}
    </div>
  )
}

function StatusPill({ style }: { style: BadgeStyle }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium",
        style.badge,
      )}
    >
      <span aria-hidden className={cn("size-[7px] shrink-0 rounded-full", style.dot)} />
      {style.label}
    </span>
  )
}
