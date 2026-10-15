import Link from "next/link"
import { FolderKanban } from "lucide-react"
import { EmptyState } from "@/app/_ui/EmptyState"
import type { Project, Ticket } from "@/core/types/crm.types"
import { orgHref } from "@/lib/nav"
import { SoftBadge } from "../../_components/SoftBadge"
import { badgeFor, type EnumView } from "../../_lib/enums"
import { formatCzkOrDash, formatDate } from "../../_lib/format"
import { ticketCountsFor } from "../../_lib/derive"
import { TicketProgress } from "./TicketProgress"

interface ProjectsPanelProps {
  orgSlug: string
  projects: Project[]
  tickets: Ticket[]
  statusView: EnumView
}

export function ProjectsPanel({ orgSlug, projects, tickets, statusView }: ProjectsPanelProps) {
  if (projects.length === 0) {
    return (
      <div className="overflow-hidden rounded-2xl border border-hairline bg-surface shadow-soft">
        <EmptyState
          icon={<FolderKanban className="size-6" />}
          title="Žádné projekty"
          description="Pro tohoto klienta zatím nebyly založeny žádné projekty."
        />
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {projects.map((project) => {
        const counts = ticketCountsFor(tickets, project.id)

        return (
          <Link
            key={project.id}
            href={orgHref(orgSlug, `/projekty/${project.id}`)}
            className="group flex flex-col gap-3 rounded-2xl border border-hairline bg-surface p-5 shadow-soft transition-colors hover:border-border-strong"
          >
            <div className="flex items-start justify-between gap-3">
              <span className="text-[15px] font-semibold text-foreground transition-colors group-hover:text-primary">
                {project.name}
              </span>
              <SoftBadge style={badgeFor(statusView, project.status)} />
            </div>
            {project.description !== undefined ? (
              <p className="line-clamp-2 text-[13px] leading-relaxed text-muted">
                {project.description}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-muted">
              <span>Termín {formatDate(project.dueAt)}</span>
              <span>Rozpočet {formatCzkOrDash(project.budgetCzk)}</span>
            </div>
            <TicketProgress done={counts.done} total={counts.total} className="mt-1" />
          </Link>
        )
      })}
    </div>
  )
}
