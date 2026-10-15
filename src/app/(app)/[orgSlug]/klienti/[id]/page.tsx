import Link from "next/link"
import { notFound } from "next/navigation"
import { ChevronRight } from "lucide-react"
import { Card, CardContent } from "@/app/_ui/Card"
import { getClient } from "@/lib/crm/store/clients"
import { listAuditForClient } from "@/lib/crm/audit/queries"
import { loadOrgEnums } from "@/lib/crm/enums/service"
import { isClientPinned } from "@/lib/crm/store/userPersonalization"
import { requireOrgContext } from "@/lib/auth/orgContext"
import { orgHref } from "@/lib/nav"
import { buildHistoryItems as buildClientHistoryItems } from "@/app/_components/HistoryCard"
import { SoftBadge } from "../_components/SoftBadge"
import { badgeFor, toEnumView } from "../_lib/enums"
import { formatCzk } from "../_lib/format"
import { ClientPinButton } from "./_components/ClientPinButton"
import { ClientStatusControl } from "./_components/ClientStatusControl"
import { EditClientDialog } from "./_components/EditClientDialog"
import { ClientTabs, type ClientTabKey } from "./_components/ClientTabs"
import { OverviewPanel } from "./_components/OverviewPanel"
import { ActivityTimelinePanel } from "./_components/ActivityTimelinePanel"
import { ProjectsPanel } from "./_components/ProjectsPanel"
import { DocumentsPanel } from "./_components/DocumentsPanel"

export const dynamic = "force-dynamic"

const TAB_KEYS: ReadonlyArray<ClientTabKey> = ["prehled", "aktivita", "projekty", "dokumenty"]

interface KlientDetailPageProps {
  params: Promise<{ orgSlug: string; id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function KlientDetailPage({ params, searchParams }: KlientDetailPageProps) {
  const { orgSlug, id } = await params
  const ctx = await requireOrgContext(orgSlug)
  const detail = await getClient(ctx.scope, id)
  if (detail === null) {
    notFound()
  }

  const { client, people, deals, projects, tickets, activities, documents } = detail
  const hasRelated =
    deals.length > 0 || projects.length > 0 || tickets.length > 0 || documents.length > 0

  const clientPinned = await isClientPinned(ctx.scope, ctx.user.id, client.id)

  const enums = await loadOrgEnums(ctx.scope.orgId)
  const statusView = toEnumView(enums.client_status)
  const serviceView = toEnumView(enums.service_kind)
  const dealStageView = toEnumView(enums.deal_stage)
  const projectStatusView = toEnumView(enums.project_status)
  const activityTypeView = toEnumView(enums.activity_type)
  const priorityView = toEnumView(enums.ticket_priority)
  const docKindView = toEnumView(enums.doc_kind)

  const resolvedSearchParams = await searchParams
  const tabParam = Array.isArray(resolvedSearchParams.tab)
    ? resolvedSearchParams.tab[0]
    : resolvedSearchParams.tab
  const initialTab = TAB_KEYS.find((key) => key === tabParam) ?? "prehled"

  const clientHistory = buildClientHistoryItems(await listAuditForClient(ctx.scope.orgId, id, 8))
  const historyHref = orgHref(ctx.org.slug, "/nastaveni?tab=historie")

  const primaryPerson = people.find((person) => person.isPrimary) ?? people[0]
  const contactParts = [
    primaryPerson?.name,
    primaryPerson?.role,
    primaryPerson?.email,
    primaryPerson?.phone,
  ].filter((part): part is string => part !== undefined)

  return (
    <div className="flex flex-col gap-6">
      <nav className="flex items-center gap-1 text-xs text-muted">
        <Link
          href={orgHref(ctx.org.slug, "/klienti")}
          className="transition-colors hover:text-foreground"
        >
          Klienti
        </Link>
        <ChevronRight className="size-3 text-muted-soft" />
        <span className="text-foreground">{client.name}</span>
      </nav>

      <Card>
        <CardContent className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 flex-col gap-3">
            <div className="flex items-center gap-2">
              <h1 className="text-[28px] font-semibold leading-tight tracking-tight text-foreground">
                {client.name}
              </h1>
              <ClientPinButton
                orgSlug={orgSlug}
                clientId={client.id}
                clientName={client.name}
                initialPinned={clientPinned}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <ClientStatusControl
                clientId={client.id}
                status={client.status}
                statusView={statusView}
              />
              {client.services.map((service) => (
                <SoftBadge key={service} style={badgeFor(serviceView, service)} withDot={false} />
              ))}
              {client.mrrCzk !== undefined ? (
                <span className="text-[13px] text-muted">
                  MRR{" "}
                  <span className="font-medium tabular-nums text-foreground">
                    {formatCzk(client.mrrCzk)}
                  </span>
                </span>
              ) : null}
            </div>
            {client.labels.length > 0 ? (
              <div className="flex flex-wrap items-center gap-1.5">
                {client.labels.map((label) => (
                  <span
                    key={label}
                    className="inline-flex items-center rounded-full bg-surface-3/60 px-2.5 py-0.5 text-[11px] font-medium text-muted"
                  >
                    {label}
                  </span>
                ))}
              </div>
            ) : null}
            {contactParts.length > 0 ? (
              <p className="text-[13px] text-muted">{contactParts.join(" · ")}</p>
            ) : null}
          </div>
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:shrink-0">
            <EditClientDialog
              client={client}
              hasRelated={hasRelated}
              statusView={statusView}
              serviceView={serviceView}
            />
          </div>
        </CardContent>
      </Card>

      <ClientTabs
        initialTab={initialTab}
        panels={{
          prehled: (
            <OverviewPanel
              orgSlug={ctx.org.slug}
              client={client}
              people={people}
              deals={deals}
              projects={projects}
              tickets={tickets}
              activities={activities}
              dealStageView={dealStageView}
              projectStatusView={projectStatusView}
              activityTypeView={activityTypeView}
              priorityView={priorityView}
              personKindOptions={enums.person_kind}
              rapportEntryKindOptions={enums.rapport_entry_kind}
              history={clientHistory}
              historyHref={historyHref}
            />
          ),
          aktivita: (
            <ActivityTimelinePanel
              clientId={client.id}
              activities={activities}
              activityTypeView={activityTypeView}
            />
          ),
          projekty: (
            <ProjectsPanel
              orgSlug={ctx.org.slug}
              projects={projects}
              tickets={tickets}
              statusView={projectStatusView}
            />
          ),
          dokumenty: (
            <DocumentsPanel
              clientId={client.id}
              documents={documents}
              docKindView={docKindView}
            />
          ),
        }}
      />
    </div>
  )
}
