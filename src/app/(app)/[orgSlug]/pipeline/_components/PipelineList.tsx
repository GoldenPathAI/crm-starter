"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { CircleDollarSign, ExternalLink } from "lucide-react"
import { Browser } from "@/app/_components/browser/Browser"
import { Dialog, DialogContent } from "@/app/_ui/Dialog"
import type {
  BrowserColumn,
  BrowserFilterOption,
  BrowserGroupConfig,
} from "@/app/_components/browser/types"
import { ToastVariant, useToast } from "@/app/_ui/Toast"
import { InlineAssigneeCell } from "@/app/_components/InlineAssigneeCell"
import { orgHref } from "@/lib/nav"
import { useOrg } from "@/app/_components/org/OrgProvider"
import { badgeStyleFor, optionBadgeStyle, styleMap, type BadgeStyle } from "@/lib/crm/config"
import { formatCzechDate } from "@/lib/dates"
import { cn } from "@/lib/cn"
import type { SortDirection } from "@/core/types/query.types"
import type { DealStage, EnumOption, OrgMember } from "@/core/types/crm.types"
import type { DealCard } from "@/lib/crm/store/deals"
import {
  deleteDealAction,
  markDealLostAction,
  moveDealStageAction,
  setDealAssigneesAction,
} from "../actions"
import { formatPercent } from "../_lib/format"
import { formatCzk } from "@/lib/money"
import type { DealListGroup, DealListSortField } from "../_lib/listQuery"
import { DealDetail, LostDialog, WonDialog } from "./dealDetail"

export interface DealListState {
  stages: string[]
  clientIds: string[]
  q: string
  sortField?: DealListSortField
  sortDir: SortDirection
  // Active group levels as URL values, primary first; empty = ungrouped.
  groups: DealListGroup[]
}

interface PipelineListProps {
  rows: DealCard[]
  total: number
  page: number
  pageSize: number
  filterClientOptions: BrowserFilterOption[]
  stageOptions: EnumOption[]
  members: OrgMember[]
  state: DealListState
}

const toStageFilterOptions = (stageOptions: EnumOption[]): BrowserFilterOption[] =>
  stageOptions.map((option) => {
    const style = optionBadgeStyle(option)

    return { value: option.value, label: style.label, dotClassName: style.dot }
  })

function buildGroups(
  rows: DealCard[],
  urlValue: string,
  clientOptions: BrowserFilterOption[],
  stageOptions: EnumOption[],
) {
  if (urlValue === "faze") {
    return stageOptions
      .map((option) => {
        const style = optionBadgeStyle(option)

        return {
          key: option.value,
          label: style.label,
          dotClassName: style.dot,
          rows: rows.filter((deal) => deal.stage === option.value),
        }
      })
      .filter((bucket) => bucket.rows.length > 0)
  }

  const labels = new Map(clientOptions.map((option) => [option.value, option.label]))
  const ids = [...new Set(rows.map((deal) => deal.clientId))]

  return ids
    .map((id) => ({
      key: id,
      label: labels.get(id) ?? id,
      rows: rows.filter((deal) => deal.clientId === id),
    }))
    .sort((a, b) => b.rows.length - a.rows.length)
}

export function PipelineList({
  rows,
  total,
  page,
  pageSize,
  filterClientOptions,
  stageOptions,
  members,
  state,
}: PipelineListProps) {
  const router = useRouter()
  const { orgSlug } = useOrg()
  const { toast } = useToast()
  const stageFilterOptions = toStageFilterOptions(stageOptions)
  const stageStyles = styleMap(stageOptions)
  const wonStage = stageOptions.find((option) => option.semantic === "won")?.value
  const lostStage = stageOptions.find((option) => option.semantic === "lost")?.value
  const [openDealId, setOpenDealId] = useState<string | null>(null)
  const [wonTargetId, setWonTargetId] = useState<string | null>(null)
  const [lostTargetId, setLostTargetId] = useState<string | null>(null)

  const openDeal = rows.find((deal) => deal.id === openDealId)
  const wonTarget = rows.find((deal) => deal.id === wonTargetId)
  const lostTarget = rows.find((deal) => deal.id === lostTargetId)

  const commitMove = (dealId: string, toStage: DealStage) => {
    void (async () => {
      const result = await moveDealStageAction(orgSlug, dealId, toStage)
      toast({
        variant: result.status === "success" ? ToastVariant.Success : ToastVariant.Error,
        title: result.status === "idle" ? undefined : result.message,
      })
      if (result.status === "success") {
        router.refresh()
      }
    })()
  }

  const requestMove = (dealId: string, toStage: DealStage) => {
    const deal = rows.find((entry) => entry.id === dealId)
    if (deal === undefined || deal.stage === toStage) {
      return
    }

    if (toStage === lostStage) {
      setOpenDealId(null)
      setLostTargetId(dealId)

      return
    }

    if (toStage === wonStage) {
      setOpenDealId(null)
      setWonTargetId(dealId)

      return
    }

    commitMove(dealId, toStage)
  }

  const runWin = async (dealId: string): Promise<boolean> => {
    if (wonStage === undefined) {
      return false
    }

    const result = await moveDealStageAction(orgSlug, dealId, wonStage)
    toast({
      variant: result.status === "success" ? ToastVariant.Success : ToastVariant.Error,
      title: result.status === "idle" ? undefined : result.message,
    })
    if (result.status === "success") {
      router.refresh()

      return true
    }

    return false
  }

  const runLost = async (dealId: string, reason: string): Promise<boolean> => {
    const result = await markDealLostAction(orgSlug, dealId, reason)
    toast({
      variant: result.status === "success" ? ToastVariant.Success : ToastVariant.Error,
      title: result.status === "idle" ? undefined : result.message,
    })
    if (result.status === "success") {
      router.refresh()

      return true
    }

    return false
  }

  const runDelete = async (dealId: string): Promise<void> => {
    const result = await deleteDealAction(orgSlug, dealId)
    toast({
      variant: result.status === "success" ? ToastVariant.Success : ToastVariant.Error,
      title: result.status === "idle" ? undefined : result.message,
    })
    if (result.status === "success") {
      setOpenDealId(null)
      router.refresh()
    }
  }

  const saveAssignees = (dealId: string, userIds: string[]): void => {
    void (async () => {
      const result = await setDealAssigneesAction(orgSlug, dealId, userIds)
      if (result.status === "error") {
        toast({ variant: ToastVariant.Error, title: result.message })

        return
      }

      router.refresh()
    })()
  }

  const columns: BrowserColumn<DealCard>[] = [
    {
      id: "title",
      header: "Deal",
      cell: (deal) => <span className="text-[13px] font-semibold text-foreground">{deal.title}</span>,
    },
    {
      id: "client",
      header: "Klient",
      filter: { kind: "checkbox", paramKey: "klient", label: "Klient", options: filterClientOptions, selected: state.clientIds },
      cell: (deal) => (
        <Link
          href={orgHref(orgSlug, `/klienti/${deal.clientId}`)}
          onClick={(event) => event.stopPropagation()}
          className="whitespace-nowrap text-[13px] text-muted transition-colors hover:text-primary"
        >
          {deal.clientName}
        </Link>
      ),
    },
    {
      id: "stage",
      header: "Fáze",
      filter: { kind: "checkbox", paramKey: "faze", label: "Fáze", options: stageFilterOptions, selected: state.stages },
      cell: (deal) => <StagePill stage={deal.stage} styles={stageStyles} />,
    },
    {
      id: "value",
      header: "Hodnota",
      sortField: "hodnota",
      cellClassName: "tabular-nums text-[13px] text-foreground",
      cell: (deal) => formatCzk(deal.valueCzk),
    },
    {
      id: "probability",
      header: "Pravděpodobnost",
      cellClassName: "tabular-nums text-[13px] text-muted",
      cell: (deal) => (deal.probability !== undefined ? formatPercent(deal.probability) : "-"),
    },
    {
      id: "days",
      header: "Dní ve fázi",
      sortField: "dni",
      cellClassName: "tabular-nums text-[13px]",
      cell: (deal) => (
        <span className={cn(deal.isStale ? "font-semibold text-orange-text" : "text-muted")}>
          {deal.daysInStage}
        </span>
      ),
    },
    {
      id: "close",
      header: "Očekávané uzavření",
      sortField: "uzavreni",
      cellClassName: "tabular-nums text-[13px]",
      cell: (deal) =>
        deal.expectedClose !== undefined ? (
          <span
            className={cn(
              deal.closeDaysUntil !== undefined && deal.closeDaysUntil < 0
                ? "font-medium text-red-text"
                : "text-muted",
            )}
          >
            {formatCzechDate(deal.expectedClose)}
          </span>
        ) : (
          <span className="text-muted-soft">-</span>
        ),
    },
    {
      id: "nextStep",
      header: "Další krok",
      cellClassName: "text-[13px]",
      cell: (deal) =>
        deal.nextStep !== undefined ? (
          <span title={deal.nextStep} className="block max-w-[220px] truncate text-muted">
            {deal.nextStep}
          </span>
        ) : (
          <span className="text-muted-soft">-</span>
        ),
    },
    {
      id: "offer",
      header: "Nabídka",
      cell: (deal) =>
        deal.offerUrl !== undefined ? (
          <a
            href={deal.offerUrl}
            target="_blank"
            rel="noreferrer"
            aria-label="Odkaz na nabídku"
            title="Odkaz na nabídku"
            onClick={(event) => event.stopPropagation()}
            className="inline-flex size-6 cursor-pointer items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-primary"
          >
            <ExternalLink className="size-3.5" />
          </a>
        ) : (
          <span className="text-[13px] text-muted-soft">-</span>
        ),
    },
    {
      id: "assignees",
      header: "Řeší",
      cell: (deal) => (
        <InlineAssigneeCell
          assignees={deal.assignees}
          members={members}
          onSave={(userIds) => setDealAssigneesAction(orgSlug, deal.id, userIds)}
        />
      ),
    },
  ]

  const groupConfig: BrowserGroupConfig<DealCard> = {
    current: state.groups,
    options: [
      { value: "faze", label: "Fáze" },
      { value: "klient", label: "Klient" },
    ],
    build: (list, urlValue) => buildGroups(list, urlValue, filterClientOptions, stageOptions),
    maxLevels: 2,
  }

  return (
    <>
      <Browser
        rows={rows}
        total={total}
        page={page}
        pageSize={pageSize}
        rowKey={(deal) => deal.id}
        columns={columns}
        sort={state.sortField !== undefined ? { field: state.sortField, direction: state.sortDir } : undefined}
        searchValue={state.q}
        searchPlaceholder="Hledat deal nebo klienta"
        searchAriaLabel="Hledat deal nebo klienta"
        group={groupConfig}
        onRowClick={(deal) => setOpenDealId(deal.id)}
        empty={{
          icon: <CircleDollarSign className="size-6" />,
          title: "Žádné dealy",
          description: "Zatím tu nejsou žádné obchodní příležitosti.",
        }}
        emptyFiltered={{
          icon: <CircleDollarSign className="size-6" />,
          title: "Žádné výsledky",
          description: "Zadanému hledání ani filtrům neodpovídá žádný deal.",
        }}
      />

      <Dialog
        open={openDeal !== undefined}
        onOpenChange={(open) => {
          if (!open) {
            setOpenDealId(null)
          }
        }}
      >
        <DialogContent className="max-w-[760px]">
          {openDeal !== undefined ? (
            <DealDetail
              deal={openDeal}
              stageOptions={stageOptions}
              members={members}
              onMove={(stage) => requestMove(openDeal.id, stage)}
              onDelete={() => runDelete(openDeal.id)}
              onAssigneesChange={(userIds) => saveAssignees(openDeal.id, userIds)}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <WonDialog
        deal={wonTarget}
        open={wonTarget !== undefined}
        onOpenChange={(open) => {
          if (!open) {
            setWonTargetId(null)
          }
        }}
        onWin={runWin}
      />

      <LostDialog
        deal={lostTarget}
        open={lostTarget !== undefined}
        onOpenChange={(open) => {
          if (!open) {
            setLostTargetId(null)
          }
        }}
        onLost={runLost}
      />
    </>
  )
}

function StagePill({ stage, styles }: { stage: DealStage; styles: Record<string, BadgeStyle> }) {
  const style = badgeStyleFor(stage, styles)

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium",
        style.badge,
      )}
    >
      <span aria-hidden className={cn("size-[7px] shrink-0 rounded-full", style.dot)} />
      {style.label}
    </span>
  )
}
