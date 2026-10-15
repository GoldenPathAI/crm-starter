"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { CircleDot, Clock, Sparkles, Tag, Trash2, TrendingUp, Users } from "lucide-react"
import { Browser } from "@/app/_components/browser/Browser"
import type {
  BrowserColumn,
  BrowserFilterOption,
  BrowserGroupConfig,
  BrowserPreset,
} from "@/app/_components/browser/types"
import { Button } from "@/app/_ui/Button"
import { ConfirmDialog } from "@/app/_ui/ConfirmDialog"
import { Popover, PopoverContent, PopoverTrigger } from "@/app/_ui/Popover"
import { ToastVariant, useToast } from "@/app/_ui/Toast"
import { useUndoToast } from "@/app/_lib/useUndoToast"
import { cn } from "@/lib/cn"
import { orgHref } from "@/lib/nav"
import { useOrg } from "@/app/_components/org/OrgProvider"
import { SortDirection, type SortOption } from "@/core/types/query.types"
import type { ActionState } from "@/app/_lib/actionState"
import type { ClientListFilters, ClientListItem } from "@/lib/crm/store/clients"
import type { ClientGroupField, ClientSortField } from "@/core/listFields"
import { SoftBadge } from "./SoftBadge"
import { badgeFor, type EnumView } from "../_lib/enums"
import { formatCzk, formatCzkOrDash, relativeDate } from "../_lib/format"
import { bulkDeleteClientsAction, bulkSetClientStatusAction } from "../actions"

export type FilterOption = BrowserFilterOption

interface ClientsTableProps {
  rows: ClientListItem[]
  total: number
  page: number
  pageSize: number
  sort: SortOption<ClientSortField> | undefined
  filters: ClientListFilters
  // Active group levels as URL values, primary first; empty means ungrouped.
  groups: ClientGroupField[]
  industryOptions: FilterOption[]
  labelOptions: FilterOption[]
  statusView: EnumView
  serviceView: EnumView
  // Query string the bare URL was rendered with. Written into the address bar
  // shallowly (no server roundtrip) so filter interactions start from explicit
  // params instead of snapping back to the defaults.
  canonicalSearch?: string
}

const cellText = "text-[13px]"

const toFilterOptions = (view: EnumView): FilterOption[] =>
  view.options.map((option) => ({
    value: option.value,
    label: option.label,
    dotClassName: badgeFor(view, option.value).dot,
  }))

export function ClientsTable({
  rows,
  total,
  page,
  pageSize,
  sort,
  filters,
  groups,
  industryOptions,
  labelOptions,
  statusView,
  serviceView,
  canonicalSearch,
}: ClientsTableProps) {
  const { orgSlug } = useOrg()

  // Selection is keyed by the live query string: any filter, sort or page change
  // resets it so the bulk bar never acts on rows that left the screen.
  const searchParams = useSearchParams()
  const paramsKey = searchParams.toString()
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set())
  useEffect(() => {
    setSelected(new Set())
  }, [paramsKey])

  useEffect(() => {
    if (canonicalSearch !== undefined && window.location.search.length === 0) {
      window.history.replaceState(
        window.history.state,
        "",
        `${window.location.pathname}?${canonicalSearch}`,
      )
    }
  }, [canonicalSearch])

  const statuses = filters.statuses ?? []
  const services = filters.services ?? []
  const industries = filters.industries ?? []
  const labels = filters.labels ?? []

  const statusOptions = toFilterOptions(statusView)
  const serviceOptions = toFilterOptions(serviceView)

  const columns: BrowserColumn<ClientListItem>[] = [
    {
      id: "name",
      header: "Klient",
      sortField: "name",
      filter: { kind: "checkbox", paramKey: "industry", label: "Obor", options: industryOptions, selected: industries },
      cell: (row) => (
        <div className="group flex min-w-0 max-w-[280px] flex-col gap-0.5">
          <span className="truncate text-[13px] font-medium text-foreground transition-colors group-hover:text-primary">
            {row.name}
          </span>
          <span title={row.industry} className="truncate text-[11px] text-muted-soft">
            {row.industry}
          </span>
        </div>
      ),
    },
    {
      id: "status",
      header: "Status",
      filter: { kind: "checkbox", paramKey: "status", label: "Status", options: statusOptions, selected: statuses },
      cell: (row) => <SoftBadge style={badgeFor(statusView, row.status)} />,
    },
    {
      id: "nextStep",
      header: "Další krok",
      cellClassName: cellText,
      cell: (row) =>
        row.nextStep !== undefined && row.nextStep.length > 0 ? (
          <span title={row.nextStep} className="block max-w-[260px] truncate text-foreground">
            {row.nextStep}
          </span>
        ) : (
          <span className="text-muted-soft">-</span>
        ),
    },
    {
      id: "overdue",
      header: "Po termínu",
      cell: (row) =>
        row.overdueTicketsCount > 0 ? (
          <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-red-soft px-2 py-0.5 text-[11px] font-semibold tabular-nums text-red-text">
            {row.overdueTicketsCount}
          </span>
        ) : (
          <span className="text-[13px] tabular-nums text-muted-soft">0</span>
        ),
    },
    {
      id: "pipeline",
      header: "Pipeline",
      sortField: "pipeline",
      cellClassName: cn("tabular-nums", cellText),
      cell: (row) =>
        row.openPipelineCzk > 0 ? (
          <span className="text-foreground">{formatCzk(row.openPipelineCzk)}</span>
        ) : (
          <span className="text-muted-soft">-</span>
        ),
    },
    {
      id: "mrr",
      header: "MRR",
      sortField: "mrr",
      cellClassName: cn("tabular-nums text-muted", cellText),
      cell: (row) => formatCzkOrDash(row.mrrCzk),
    },
    {
      id: "lastContact",
      header: "Poslední kontakt",
      sortField: "lastContactAt",
      cellClassName: cn("whitespace-nowrap text-muted", cellText),
      cell: (row) => relativeDate(row.lastContactAt),
    },
    {
      id: "services",
      header: "Služby",
      filter: { kind: "checkbox", paramKey: "service", label: "Služby", options: serviceOptions, selected: services },
      cell: (row) => <ServiceChips services={row.services} serviceView={serviceView} />,
    },
    {
      id: "labels",
      header: "Štítky",
      filter: { kind: "checkbox", paramKey: "label", label: "Štítky", options: labelOptions, selected: labels },
      cell: (row) => <LabelChips labels={row.labels} />,
    },
  ]

  const activeStatus = statusView.options.find((option) => option.semantic === "active")?.value
  const inquiryStatus = statusView.options.find((option) => option.semantic === "inquiry")?.value

  const presets: BrowserPreset[] = [
    ...(activeStatus !== undefined
      ? [{ key: "active", label: "Aktivní", icon: CircleDot, params: { status: activeStatus } }]
      : []),
    ...(inquiryStatus !== undefined
      ? [{ key: "leads", label: "Poptávky", icon: Sparkles, params: { status: inquiryStatus } }]
      : []),
    {
      key: "pipeline",
      label: "Nejvyšší pipeline",
      icon: TrendingUp,
      params: { sortField: "pipeline", sortDir: SortDirection.Desc },
    },
    {
      key: "cold",
      label: "Nejdéle bez kontaktu",
      icon: Clock,
      params: { sortField: "lastContactAt", sortDir: SortDirection.Asc },
    },
  ]

  const groupConfig: BrowserGroupConfig<ClientListItem> = {
    current: groups,
    maxLevels: 2,
    // The bare URL rests on group=status, so removing all grouping must write
    // the explicit `none` sentinel instead of dropping the param.
    clearsToNone: true,
    options: [
      { value: "status", label: "Status" },
      { value: "service", label: "Služba" },
      { value: "industry", label: "Obor" },
    ],
    build: (list, field) =>
      buildGroups(list, field as ClientGroupField, industryOptions, statusView, serviceView),
  }

  return (
    <Browser
      rows={rows}
      total={total}
      page={page}
      pageSize={pageSize}
      rowKey={(row) => row.id}
      columns={columns}
      sort={sort}
      searchValue={filters.q ?? ""}
      searchPlaceholder="Hledat klienty"
      searchAriaLabel="Hledat klienty"
      presets={presets}
      group={groupConfig}
      rowHref={(row) => orgHref(orgSlug, `/klienti/${row.id}`)}
      selection={{
        selected,
        onChange: setSelected,
        actions: (
          <ClientsBulkActions
            orgSlug={orgSlug}
            selectedIds={[...selected]}
            statusView={statusView}
            onDone={() => setSelected(new Set())}
          />
        ),
      }}
      empty={{ icon: <Users className="size-6" />, title: "Žádní klienti", description: "Zatím tu nejsou žádní klienti." }}
      emptyFiltered={{
        icon: <Users className="size-6" />,
        title: "Žádné výsledky",
        description: "Zadanému hledání ani filtrům neodpovídá žádný klient.",
      }}
    />
  )
}

function ClientsBulkActions({
  orgSlug,
  selectedIds,
  statusView,
  onDone,
}: {
  orgSlug: string
  selectedIds: string[]
  statusView: EnumView
  onDone: () => void
}) {
  const { toast } = useToast()
  const { toastWithUndo } = useUndoToast()
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [statusOpen, setStatusOpen] = useState(false)

  const run = (action: () => Promise<ActionState>) => {
    startTransition(async () => {
      const result = await action()
      if (result.status === "success") {
        toastWithUndo(result, () => router.refresh())
        onDone()
        router.refresh()
      } else if (result.status === "error") {
        toast({ variant: ToastVariant.Error, title: result.message })
      }
    })
  }

  return (
    <>
      <Popover open={statusOpen} onOpenChange={setStatusOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" disabled={pending} className="cursor-pointer">
            <Tag className="size-4" />
            Změnit status
          </Button>
        </PopoverTrigger>
        <PopoverContent align="center" side="top" className="w-auto p-1">
          <div className="flex min-w-44 flex-col gap-0.5">
            {statusView.options.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  setStatusOpen(false)
                  run(() => bulkSetClientStatusAction(orgSlug, selectedIds, option.value))
                }}
                className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm text-foreground transition-colors hover:bg-surface-2"
              >
                <span
                  aria-hidden
                  className={cn("size-[7px] shrink-0 rounded-full", badgeFor(statusView, option.value).dot)}
                />
                {option.label}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
      <ConfirmDialog
        trigger={
          <Button
            variant="ghost"
            size="sm"
            disabled={pending}
            className="cursor-pointer text-danger hover:bg-danger-soft hover:text-danger"
          >
            <Trash2 className="size-4" />
            Smazat
          </Button>
        }
        title="Smazat vybrané klienty"
        description={`Vybraní klienti (${selectedIds.length}) budou smazáni. Klienty s navázanými záznamy smazat nelze, ty zůstanou beze změny.`}
        confirmLabel="Smazat"
        destructive
        onConfirm={async () => {
          const result = await bulkDeleteClientsAction(orgSlug, selectedIds)
          if (result.status === "success") {
            toastWithUndo(result, () => router.refresh())
            onDone()
            router.refresh()
          } else if (result.status === "error") {
            toast({ variant: ToastVariant.Error, title: result.message })
          }
        }}
      />
    </>
  )
}

function buildGroups(
  rows: ClientListItem[],
  group: ClientGroupField,
  industryOptions: FilterOption[],
  statusView: EnumView,
  serviceView: EnumView,
) {
  if (group === "status") {
    return statusView.options
      .map((option) => ({
        key: option.value,
        label: option.label,
        dotClassName: badgeFor(statusView, option.value).dot,
        rows: rows.filter((row) => row.status === option.value),
      }))
      .filter((bucket) => bucket.rows.length > 0)
  }

  if (group === "service") {
    return serviceView.options
      .map((option) => ({
        key: option.value,
        label: option.label,
        dotClassName: badgeFor(serviceView, option.value).dot,
        rows: rows.filter((row) => row.services.some((service) => service === option.value)),
      }))
      .filter((bucket) => bucket.rows.length > 0)
  }

  const known = industryOptions.map((option) => option.value)
  const industries = [...new Set([...known, ...rows.map((row) => row.industry)])].sort((a, b) =>
    a.localeCompare(b, "cs"),
  )

  return industries
    .map((industry) => ({
      key: industry,
      label: industry,
      rows: rows.filter((row) => row.industry === industry),
    }))
    .filter((bucket) => bucket.rows.length > 0)
}

function LabelChips({ labels }: { labels: string[] }) {
  if (labels.length === 0) {
    return <span className="text-[13px] text-muted-soft">-</span>
  }

  const visible = labels.slice(0, 3)
  const hidden = labels.length - visible.length

  return (
    <div className="flex flex-wrap items-center gap-1">
      {visible.map((label) => (
        <span
          key={label}
          className="inline-flex items-center rounded-full bg-surface-3/60 px-2 py-0.5 text-[11px] font-medium text-muted"
        >
          {label}
        </span>
      ))}
      {hidden > 0 ? (
        <span className="inline-flex items-center rounded-full bg-surface-3/60 px-2 py-0.5 text-[11px] font-medium text-muted">
          +{hidden}
        </span>
      ) : null}
    </div>
  )
}

function ServiceChips({ services, serviceView }: { services: string[]; serviceView: EnumView }) {
  const visible = services.slice(0, 2)
  const hidden = services.length - visible.length

  return (
    <div className="flex flex-wrap items-center gap-1">
      {visible.map((service) => (
        <SoftBadge key={service} style={badgeFor(serviceView, service)} withDot={false} />
      ))}
      {hidden > 0 ? (
        <span className="inline-flex items-center rounded-full bg-surface-3/60 px-2 py-0.5 text-[11px] font-medium text-muted">
          +{hidden}
        </span>
      ) : null}
    </div>
  )
}
