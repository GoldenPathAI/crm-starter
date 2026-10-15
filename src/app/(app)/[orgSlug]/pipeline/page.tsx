import { AlertTriangle, CircleCheck, CircleDollarSign, Scale } from "lucide-react"
import { PageHeader } from "@/app/_ui/PageHeader"
import { PageShell } from "@/app/_ui/PageShell"
import { StatCard, StatHue } from "@/app/_ui/Stat"
import { listClientOptions, listDealsByStage } from "@/lib/crm/store/deals"
import { listOrgMembers } from "@/lib/crm/store/members"
import { requireOrgContext } from "@/lib/auth/orgContext"
import { loadOrgEnums } from "@/lib/crm/enums/service"
import {
  cleanList,
  cleanText,
  enumList,
  matchEnum,
  parseGroupLevels,
  parsePage,
  parseSortDir,
  single,
  type BrowserSearchParams,
} from "@/app/_components/browser/queryHelpers"
import { applyDefaultSavedView } from "@/app/_lib/defaultView"
import type { BrowserFilterOption } from "@/app/_components/browser/types"
import { parsePageSize } from "@/lib/pageSize"
import { SortDirection } from "@/core/types/query.types"
import type { EnumOption, OrgMember } from "@/core/types/crm.types"
import type { DealCard } from "@/lib/crm/store/deals"
import { PipelineBoard } from "./_components/PipelineBoard"
import { PipelineList, type DealListState } from "./_components/PipelineList"
import {
  DEAL_LIST_GROUPS,
  DEAL_LIST_SORT_FIELDS,
  PIPELINE_VIEWS,
  type DealListSortField,
} from "./_lib/listQuery"
import { ViewToggle } from "./_components/ViewToggle"
import { NewDealButton } from "./_components/NewDealButton"
import { formatCzk } from "@/lib/money"

export const dynamic = "force-dynamic"


const pluralDeals = (count: number): string => {
  if (count === 1) {
    return "1 deal"
  }

  if (count >= 2 && count <= 4) {
    return `${count} dealy`
  }

  return `${count} dealů`
}

const compareDeals = (a: DealCard, b: DealCard, field: DealListSortField, direction: SortDirection): number => {
  const factor = direction === SortDirection.Desc ? -1 : 1
  if (field === "hodnota") {
    return factor * (a.valueCzk - b.valueCzk)
  }

  if (field === "dni") {
    return factor * (a.daysInStage - b.daysInStage)
  }

  return factor * (a.expectedClose ?? "9999-99-99").localeCompare(b.expectedClose ?? "9999-99-99")
}

export default async function PipelinePage({
  searchParams,
  params,
}: {
  searchParams: Promise<BrowserSearchParams>
  params: Promise<{ orgSlug: string }>
}) {
  const resolvedParams = await searchParams
  const { orgSlug } = await params
  const view = matchEnum(single(resolvedParams.view), PIPELINE_VIEWS) ?? "kanban"
  const deepLinkDealId = cleanText(single(resolvedParams.deal))

  const ctx = await requireOrgContext(orgSlug)
  await applyDefaultSavedView(ctx, orgSlug, "pipeline", resolvedParams)
  const [columns, clientOptions, enums, members] = await Promise.all([
    listDealsByStage(ctx.scope),
    listClientOptions(ctx.scope),
    loadOrgEnums(ctx.scope.orgId),
    listOrgMembers(ctx.scope.orgId),
  ])
  const stageOptions = enums.deal_stage

  // One definition of "open pipeline" across the app (dashboard, finance, here):
  // the actively-progressing "open" group only, parked deals are set aside.
  const openStageValues = new Set(
    stageOptions
      .filter((option) => option.semantic === "open")
      .map((option) => option.value),
  )
  const openColumns = columns.filter((column) => openStageValues.has(column.stage))
  const openDeals = openColumns.flatMap((column) => column.deals)
  const openPipelineCzk = openColumns.reduce((sum, column) => sum + column.sumCzk, 0)
  const weightedPipelineCzk = openDeals.reduce(
    (sum, deal) => sum + deal.valueCzk * ((deal.probability ?? 0) / 100),
    0,
  )
  const openDealsCount = openDeals.length
  const attentionCount = openDeals.filter(
    (deal) => deal.isStale || (deal.closeDaysUntil !== undefined && deal.closeDaysUntil < 0),
  ).length

  return (
    <PageShell wide className="gap-6">
      <PageHeader
        title="Pipeline"
        description="Obchodní příležitosti podle fází"
        actions={
          <div className="flex items-center gap-2">
            <ViewToggle view={view} />
            <NewDealButton clientOptions={clientOptions} stageOptions={stageOptions} members={members} />
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Otevřená pipeline"
          value={formatCzk(openPipelineCzk)}
          hint={`${pluralDeals(openDealsCount)} v jednání`}
          hue={StatHue.Blue}
          icon={CircleDollarSign}
        />
        <StatCard
          label="Vážená pipeline"
          value={formatCzk(weightedPipelineCzk)}
          hint="Podle pravděpodobnosti uzavření"
          hue={StatHue.Indigo}
          icon={Scale}
        />
        <StatCard
          label="Vyžaduje pozornost"
          value={String(attentionCount)}
          hint={attentionCount === 0 ? "Vše se hýbe včas" : "Bez pohybu 21+ dní nebo po termínu"}
          hue={attentionCount === 0 ? StatHue.Green : StatHue.Red}
          icon={attentionCount === 0 ? CircleCheck : AlertTriangle}
          emphasize={attentionCount > 0}
        />
      </div>

      {view === "list" ? (
        <PipelineListView
          params={resolvedParams}
          columns={columns}
          stageOptions={stageOptions}
          members={members}
        />
      ) : (
        <PipelineBoard
          columns={columns}
          stageOptions={stageOptions}
          members={members}
          initialOpenDealId={deepLinkDealId}
        />
      )}
    </PageShell>
  )
}

function PipelineListView({
  params,
  columns,
  stageOptions,
  members,
}: {
  params: BrowserSearchParams
  columns: Awaited<ReturnType<typeof listDealsByStage>>
  stageOptions: EnumOption[]
  members: OrgMember[]
}) {
  const allDeals = columns.flatMap((column) => column.deals)

  const stages = enumList(
    params.faze,
    stageOptions.map((option) => option.value),
  )
  const clientIds = cleanList(params.klient)
  const q = cleanText(single(params.q)) ?? ""
  const sortField = matchEnum(single(params.sortField), DEAL_LIST_SORT_FIELDS)
  const sortDir = parseSortDir(single(params.sortDir))
  const groups = parseGroupLevels(params.group, DEAL_LIST_GROUPS, { default: [], maxLevels: 2 })
  const page = parsePage(single(params.page))
  const pageSize = parsePageSize(params.pageSize)

  const filterClientOptions: BrowserFilterOption[] = [
    ...new Map(allDeals.map((deal) => [deal.clientId, deal.clientName])),
  ]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label, "cs"))

  const needle = q.toLowerCase()
  const filtered = allDeals
    .filter((deal) => (stages.length > 0 ? stages.includes(deal.stage) : true))
    .filter((deal) => (clientIds.length > 0 ? clientIds.includes(deal.clientId) : true))
    .filter((deal) =>
      needle.length > 0
        ? `${deal.title} ${deal.clientName}`.toLowerCase().includes(needle)
        : true,
    )
    .sort((a, b) => (sortField !== undefined ? compareDeals(a, b, sortField, sortDir) : 0))

  const total = filtered.length
  const grouped = groups.length > 0
  const rows = grouped
    ? filtered
    : filtered.slice((page - 1) * pageSize, (page - 1) * pageSize + pageSize)

  const state: DealListState = { stages, clientIds, q, sortField, sortDir, groups }

  return (
    <PipelineList
      rows={rows}
      total={total}
      page={page}
      pageSize={pageSize}
      filterClientOptions={filterClientOptions}
      stageOptions={stageOptions}
      members={members}
      state={state}
    />
  )
}
