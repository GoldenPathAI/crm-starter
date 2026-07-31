import type { ReactNode } from "react"
import Link from "next/link"
import { ArrowUpRight } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/app/_ui/Card"
import { ExpandableText } from "@/app/_ui/ExpandableText"
import { todayIso } from "@/lib/crm/config"
import type {
  Activity,
  Client,
  Deal,
  EnumOption,
  Person,
  Project,
  TicketWithAssignees,
} from "@/core/types/crm.types"
import { orgHref } from "@/lib/nav"
import { SoftBadge } from "../../_components/SoftBadge"
import { ActivityIcon, actorLabel } from "../../_components/activity"
import { badgeFor, type EnumView } from "../../_lib/enums"
import { formatCzk, formatDate, relativeDate } from "../../_lib/format"
import { isActiveProject, isOpenDeal, ticketCountsFor } from "../../_lib/derive"
import { TicketProgress } from "./TicketProgress"
import { AddNoteButton, LogActivityMenu } from "./ClientActions"
import { ContactsCard } from "./ContactsCard"
import { ClientTasksCard } from "./ClientTasksCard"
import { ClientFieldEditor } from "./ClientFieldEditor"
import { HistoryCard, type HistoryItem as ClientHistoryItem } from "@/app/_components/HistoryCard"

interface OverviewPanelProps {
  orgSlug: string
  client: Client
  people: Person[]
  deals: Deal[]
  projects: Project[]
  tickets: TicketWithAssignees[]
  activities: Activity[]
  dealStageView: EnumView
  projectStatusView: EnumView
  activityTypeView: EnumView
  priorityView: EnumView
  personKindOptions: EnumOption[]
  rapportEntryKindOptions: EnumOption[]
  history: ClientHistoryItem[]
  historyHref: string
}

export function OverviewPanel({
  orgSlug,
  client,
  people,
  deals,
  projects,
  tickets,
  activities,
  dealStageView,
  projectStatusView,
  activityTypeView,
  priorityView,
  personKindOptions,
  rapportEntryKindOptions,
  history,
  historyHref,
}: OverviewPanelProps) {
  const openDeals = deals.filter(isOpenDeal)
  const activeProjects = projects.filter(isActiveProject)
  const recentActivities = activities.slice(0, 5)
  const notes = activities.filter((activity) => activity.type === "poznamka").slice(0, 6)
  const today = todayIso()

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      <div className="flex flex-col gap-5">
        <Card>
          <CardHeader>
            <CardTitle>Informace</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2">
              <Fact label="Obor">
                <ExpandableText text={client.industry} lineClamp="line-clamp-3" />
              </Fact>
              <Fact label="Město">{client.city ?? "-"}</Fact>
              <Fact label="IČO">{client.ico ?? "-"}</Fact>
              <Fact label="Web">
                {client.website !== undefined ? (
                  <a
                    href={`https://${client.website.replace(/^https?:\/\//, "")}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-primary transition-colors hover:text-primary-hover"
                  >
                    {client.website.replace(/^https?:\/\//, "")}
                    <ArrowUpRight className="size-3.5" />
                  </a>
                ) : (
                  "-"
                )}
              </Fact>
              <Fact label="Vytvořeno">{formatDate(client.createdAt)}</Fact>
              <Fact label="Poslední kontakt">{relativeDate(client.lastContactAt)}</Fact>
              <div className="sm:col-span-2">
                <Fact label="Další krok">
                  <ClientFieldEditor
                    clientId={client.id}
                    field="nextStep"
                    label="Další krok"
                    value={client.nextStep}
                  />
                </Fact>
              </div>
              <div className="sm:col-span-2">
                <Fact label="Poznámka">
                  <ClientFieldEditor
                    clientId={client.id}
                    field="note"
                    label="Poznámka"
                    value={client.note}
                    multiline
                  />
                </Fact>
              </div>
            </dl>
          </CardContent>
        </Card>

        <ContactsCard
          client={client}
          people={people}
          personKindOptions={personKindOptions}
          rapportEntryKindOptions={rapportEntryKindOptions}
        />

        <ClientTasksCard
          clientId={client.id}
          tasks={tickets}
          today={today}
          priorityView={priorityView}
        />

        <Card>
          <CardHeader>
            <CardTitle>Poznámky</CardTitle>
            <div className="flex items-center gap-3">
              <span className="text-[13px] tabular-nums text-muted-soft">{notes.length}</span>
              <AddNoteButton clientId={client.id} />
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {notes.length > 0 ? (
              notes.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-start gap-3 border-b border-hairline pb-4 last:border-0 last:pb-0"
                >
                  <ActivityIcon type={activity.type} view={activityTypeView} />
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="text-[13px] font-medium text-foreground">
                      {activity.title}
                    </span>
                    {activity.body !== undefined ? (
                      <span className="text-[13px] leading-relaxed text-muted">
                        {activity.body}
                      </span>
                    ) : null}
                    <span className="text-xs text-muted-soft">
                      {actorLabel(activity.actorType, activity.actorName)} ·{" "}
                      {relativeDate(activity.occurredAt)}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-[13px] text-muted-soft">Žádné poznámky</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-5">
        <Card>
          <CardHeader>
            <CardTitle>Otevřené dealy</CardTitle>
            <span className="text-[13px] tabular-nums text-muted-soft">{openDeals.length}</span>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {openDeals.length > 0 ? (
              openDeals.map((deal) => (
                <div
                  key={deal.id}
                  className="flex flex-col gap-1.5 border-b border-hairline pb-4 last:border-0 last:pb-0"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-[15px] font-medium text-foreground">{deal.title}</span>
                    <span className="shrink-0 text-[15px] font-semibold tabular-nums text-foreground">
                      {formatCzk(deal.valueCzk)}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <SoftBadge style={badgeFor(dealStageView, deal.stage)} />
                    {deal.nextStep !== undefined ? (
                      <span className="text-[13px] text-muted">{deal.nextStep}</span>
                    ) : null}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-[13px] text-muted-soft">Žádné otevřené dealy</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Aktivní projekty</CardTitle>
            <span className="text-[13px] tabular-nums text-muted-soft">
              {activeProjects.length}
            </span>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {activeProjects.length > 0 ? (
              activeProjects.map((project) => {
                const counts = ticketCountsFor(tickets, project.id)
                return (
                  <Link
                    key={project.id}
                    href={orgHref(orgSlug, `/projekty/${project.id}`)}
                    className="group flex flex-col gap-2.5 border-b border-hairline pb-4 last:border-0 last:pb-0"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-[15px] font-medium text-foreground transition-colors group-hover:text-primary">
                        {project.name}
                      </span>
                      <SoftBadge style={badgeFor(projectStatusView, project.status)} />
                    </div>
                    {project.dueAt !== undefined ? (
                      <span className="text-[13px] text-muted">
                        Termín {formatDate(project.dueAt)}
                      </span>
                    ) : null}
                    <TicketProgress done={counts.done} total={counts.total} />
                  </Link>
                )
              })
            ) : (
              <p className="text-[13px] text-muted-soft">Žádné aktivní projekty</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Poslední aktivita</CardTitle>
            <LogActivityMenu clientId={client.id} />
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {recentActivities.length > 0 ? (
              recentActivities.map((activity) => (
                <div key={activity.id} className="flex items-start gap-3">
                  <ActivityIcon type={activity.type} view={activityTypeView} />
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="text-[13px] font-medium text-foreground">
                      {activity.title}
                    </span>
                    <span className="text-xs text-muted-soft">
                      {actorLabel(activity.actorType, activity.actorName)} ·{" "}
                      {relativeDate(activity.occurredAt)}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-[13px] text-muted-soft">Žádná aktivita</p>
            )}
          </CardContent>
        </Card>

        <HistoryCard items={history} historyHref={historyHref} />
      </div>
    </div>
  )
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <dt className="text-[13px] text-muted-soft">{label}</dt>
      <dd className="text-[15px] text-foreground">{children}</dd>
    </div>
  )
}
