"use client"

import { type MouseEvent, useEffect, useOptimistic, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { addDays, format, parseISO } from "date-fns"
import {
  CalendarClock,
  CalendarPlus,
  Check,
  CheckCircle2,
  Flag,
  Repeat,
  Trash2,
  UserPlus,
  X,
} from "lucide-react"
import { Browser } from "@/app/_components/browser/Browser"
import type {
  BrowserColumn,
  BrowserFilterOption,
  BrowserGroupConfig,
  BrowserViewTabs,
} from "@/app/_components/browser/types"
import { Button } from "@/app/_ui/Button"
import { Checkbox } from "@/app/_ui/Checkbox"
import { ConfirmDialog } from "@/app/_ui/ConfirmDialog"
import { DatePicker } from "@/app/_ui/DatePicker"
import { Popover, PopoverContent, PopoverTrigger } from "@/app/_ui/Popover"
import { useToast } from "@/app/_ui/Toast"
import { useUndoToast } from "@/app/_lib/useUndoToast"
import { useTaskDetail } from "@/app/_components/task-detail/TaskDetailProvider"
import { InlineAssigneeCell } from "@/app/_components/InlineAssigneeCell"
import { useOrg } from "@/app/_components/org/OrgProvider"
import { patchTaskAction, setTicketAssigneesAction } from "@/app/_components/task-detail/actions"
import { orgHref } from "@/lib/nav"
import { badgeStyleFor, optionBadgeStyle, styleMap, type BadgeStyle } from "@/lib/crm/config"
import { formatCzechDate } from "@/lib/dates"
import { cn } from "@/lib/cn"
import type { ActionState } from "@/app/_lib/actionState"
import type { EnumOption, OrgMember, TicketRecurrence } from "@/core/types/crm.types"
import type { TicketListItem } from "@/lib/crm/queries"
import type { TicketQueryState, TicketView } from "../_lib/parseTicketQuery"
import { TICKET_VIEWS } from "../_lib/parseTicketQuery"
import {
  bulkAssignTicketsAction,
  bulkCompleteTicketsAction,
  bulkDeleteTicketsAction,
  bulkSetTicketPriorityAction,
  quickEditTicketAction,
  quickSetTicketStatusAction,
} from "../actions"

interface TicketsTableProps {
  rows: TicketListItem[]
  total: number
  page: number
  pageSize: number
  clientOptions: BrowserFilterOption[]
  assigneeOptions: BrowserFilterOption[]
  members: OrgMember[]
  statusOptions: EnumOption[]
  priorityOptions: EnumOption[]
  doneValue: string
  state: TicketQueryState
  viewCounts: Record<TicketView, number>
  today: string
}

const VIEW_LABELS: Readonly<Record<TicketView, string>> = {
  otevrene: "Otevřené",
  "po-terminu": "Po termínu",
  dnes: "Dnes",
  tyden: "Tento týden",
  "bez-terminu": "Bez termínu",
  hotove: "Hotové",
}

const RECURRENCE_TOOLTIPS: Readonly<Record<TicketRecurrence, string>> = {
  weekly: "Opakuje se týdně",
  biweekly: "Opakuje se každé 2 týdny",
  monthly: "Opakuje se měsíčně",
  quarterly: "Opakuje se čtvrtletně",
}

const toFilterOptions = (options: EnumOption[]): BrowserFilterOption[] =>
  options.map((option) => ({
    value: option.value,
    label: option.label,
    dotClassName: optionBadgeStyle(option).dot,
  }))

function buildGroups(
  rows: TicketListItem[],
  urlValue: string,
  clientOptions: BrowserFilterOption[],
  assigneeOptions: BrowserFilterOption[],
  statusOptions: EnumOption[],
  priorityOptions: EnumOption[],
) {
  if (urlValue === "status") {
    return statusOptions
      .map((option) => ({
        key: option.value,
        label: option.label,
        dotClassName: optionBadgeStyle(option).dot,
        rows: rows.filter((ticket) => ticket.status === option.value),
      }))
      .filter((bucket) => bucket.rows.length > 0)
  }
  if (urlValue === "priorita") {
    return priorityOptions
      .map((option) => ({
        key: option.value,
        label: option.label,
        dotClassName: optionBadgeStyle(option).dot,
        rows: rows.filter((ticket) => ticket.priority === option.value),
      }))
      .filter((bucket) => bucket.rows.length > 0)
  }
  if (urlValue === "resitel") {
    // A multi-assignee ticket shows under each of its assignees (the Browser
    // namespaces row keys per bucket); unassigned tickets trail in one bucket.
    const buckets = assigneeOptions
      .map((option) => ({
        key: option.value,
        label: option.label,
        rows: rows.filter((ticket) =>
          ticket.assignees.some((assignee) => assignee.userId === option.value),
        ),
      }))
      .filter((bucket) => bucket.rows.length > 0)
    const unassigned = rows.filter((ticket) => ticket.assignees.length === 0)
    return unassigned.length > 0
      ? [...buckets, { key: "none", label: "Bez řešitele", rows: unassigned }]
      : buckets
  }
  const labels = new Map(clientOptions.map((option) => [option.value, option.label]))
  const ids = [...new Set(rows.map((ticket) => ticket.clientId))]
  return ids
    .map((id) => ({
      key: id,
      label: labels.get(id) ?? id,
      rows: rows.filter((ticket) => ticket.clientId === id),
    }))
    .sort((a, b) => b.rows.length - a.rows.length)
}

export function TicketsTable({
  rows,
  total,
  page,
  pageSize,
  clientOptions,
  assigneeOptions,
  members,
  statusOptions,
  priorityOptions,
  doneValue,
  state,
  viewCounts,
  today,
}: TicketsTableProps) {
  const { openTask } = useTaskDetail()
  const { orgSlug } = useOrg()

  // Selection is keyed by the live query string: any filter, view, sort or page
  // change resets it so the bulk bar never acts on rows that left the screen.
  const searchParams = useSearchParams()
  const paramsKey = searchParams.toString()
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set())
  useEffect(() => {
    setSelected(new Set())
  }, [paramsKey])

  const statusStyles = styleMap(statusOptions)
  const priorityStyles = styleMap(priorityOptions)
  const reopenValue =
    statusOptions.find((option) => option.semantic === "todo")?.value ??
    statusOptions.find((option) => option.value !== doneValue)?.value ??
    doneValue

  const statusFilterOptions = toFilterOptions(
    statusOptions.filter((option) => option.semantic !== "done"),
  )
  const priorityFilterOptions = toFilterOptions(priorityOptions)

  // A status change that moves the ticket out of the current view (done in an
  // open view, reopened in Hotové) hides the row optimistically; the fresh rows
  // from revalidatePath then confirm the removal instead of causing it.
  const [hiddenIds, addHiddenId] = useOptimistic<ReadonlySet<string>, string>(
    new Set<string>(),
    (prev, id) => new Set([...prev, id]),
  )
  const hideWhenLeavingView = (ticketId: string, nextStatus: string) => {
    const done = nextStatus === doneValue
    if (state.view === "hotove" ? !done : done) {
      addHiddenId(ticketId)
    }
  }
  const visibleRows = hiddenIds.size > 0 ? rows.filter((ticket) => !hiddenIds.has(ticket.id)) : rows
  const visibleTotal = total - (rows.length - visibleRows.length)

  const columns: BrowserColumn<TicketListItem>[] = [
    {
      id: "title",
      header: "Úkol",
      sortField: "title",
      cell: (ticket) => (
        <div className="flex flex-col gap-0.5">
          <span className="flex items-center gap-1.5">
            <TitleQuickEdit ticket={ticket} orgSlug={orgSlug} />
            {ticket.recurrence !== undefined ? (
              <span title={RECURRENCE_TOOLTIPS[ticket.recurrence]}>
                <Repeat className="size-3 shrink-0 text-muted-soft" />
              </span>
            ) : null}
          </span>
          {ticket.projectId !== undefined && ticket.projectName !== null ? (
            <Link
              href={orgHref(orgSlug, `/projekty/${ticket.projectId}`)}
              onClick={(event) => event.stopPropagation()}
              className="w-fit text-xs text-muted transition-colors hover:text-primary"
            >
              {ticket.projectName}
            </Link>
          ) : (
            <span className="w-fit text-xs text-muted-soft">-</span>
          )}
        </div>
      ),
    },
    {
      id: "client",
      header: "Klient",
      filter: { kind: "checkbox", paramKey: "klient", label: "Klient", options: clientOptions, selected: state.clientIds },
      cell: (ticket) => (
        <Link
          href={orgHref(orgSlug, `/klienti/${ticket.clientId}`)}
          onClick={(event) => event.stopPropagation()}
          className="whitespace-nowrap text-[13px] text-muted transition-colors hover:text-primary"
        >
          {ticket.clientName}
        </Link>
      ),
    },
    {
      id: "status",
      header: "Status",
      filter: { kind: "checkbox", paramKey: "status", label: "Status", options: statusFilterOptions, selected: state.statuses },
      cell: (ticket) => (
        <StatusQuickEdit
          ticket={ticket}
          orgSlug={orgSlug}
          statusOptions={statusOptions}
          statusStyles={statusStyles}
          onStatusChange={hideWhenLeavingView}
        />
      ),
    },
    {
      id: "priority",
      header: "Priorita",
      sortField: "priority",
      filter: { kind: "checkbox", paramKey: "priorita", label: "Priorita", options: priorityFilterOptions, selected: state.priorities },
      cell: (ticket) => (
        <PriorityQuickEdit
          ticket={ticket}
          orgSlug={orgSlug}
          priorityOptions={priorityOptions}
          priorityStyles={priorityStyles}
        />
      ),
    },
    {
      id: "assignees",
      header: "Řeší",
      filter: { kind: "checkbox", paramKey: "resitel", label: "Řeší", options: assigneeOptions, selected: state.assigneeIds },
      cell: (ticket) => (
        <InlineAssigneeCell
          assignees={ticket.assignees}
          members={members}
          onSave={(userIds) => setTicketAssigneesAction(orgSlug, ticket.id, userIds)}
        />
      ),
    },
    {
      id: "due",
      header: "Termín",
      sortField: "due",
      cellClassName: "tabular-nums text-[13px]",
      cell: (ticket) => <DueQuickEdit ticket={ticket} today={today} orgSlug={orgSlug} />,
    },
    {
      id: "done",
      header: "Hotovo",
      cell: (ticket) => (
        <DoneQuickToggle
          ticket={ticket}
          orgSlug={orgSlug}
          doneValue={doneValue}
          reopenValue={reopenValue}
          onStatusChange={hideWhenLeavingView}
        />
      ),
    },
  ]

  const viewTabs: BrowserViewTabs = {
    paramKey: "zobrazit",
    defaultValue: "otevrene",
    current: state.view,
    tabs: TICKET_VIEWS.map((view) => ({
      value: view,
      label: VIEW_LABELS[view],
      count: viewCounts[view],
      alert: view === "po-terminu",
    })),
  }

  const groupConfig: BrowserGroupConfig<TicketListItem> = {
    current: state.groups,
    maxLevels: 2,
    // The bare URL defaults to Klient > Řešitel, so removing all grouping must
    // write the explicit `none` sentinel instead of dropping the param.
    clearsToNone: true,
    options: [
      { value: "klient", label: "Klient" },
      { value: "resitel", label: "Řešitel" },
      { value: "status", label: "Stav" },
      { value: "priorita", label: "Priorita" },
    ],
    build: (list, urlValue) =>
      buildGroups(list, urlValue, clientOptions, assigneeOptions, statusOptions, priorityOptions),
  }

  const emptyIsGood = state.view === "po-terminu" || state.view === "otevrene"

  return (
    <Browser
      rows={visibleRows}
      total={visibleTotal}
      page={page}
      pageSize={pageSize}
      rowKey={(ticket) => ticket.id}
      onRowClick={(ticket) => openTask(ticket.id)}
      columns={columns}
      sort={state.sortField !== undefined ? { field: state.sortField, direction: state.sortDir } : undefined}
      searchValue={state.q}
      searchPlaceholder="Hledat úkol, klienta, projekt"
      searchAriaLabel="Hledat úkol, klienta, projekt"
      viewTabs={viewTabs}
      group={groupConfig}
      selection={{
        selected,
        onChange: setSelected,
        actions: (
          <TicketsBulkActions
            orgSlug={orgSlug}
            selectedIds={[...selected]}
            priorityOptions={priorityOptions}
            assigneeOptions={assigneeOptions}
            onDone={() => setSelected(new Set())}
            onComplete={(ids) => {
              for (const id of ids) {
                hideWhenLeavingView(id, doneValue)
              }
            }}
          />
        ),
      }}
      empty={{
        icon: emptyIsGood ? <Check className="size-6" /> : <CalendarClock className="size-6" />,
        title: VIEW_EMPTY[state.view].title,
        description: VIEW_EMPTY[state.view].description,
      }}
      emptyFiltered={{
        icon: <X className="size-6" />,
        title: "Žádné výsledky",
        description: "Zadanému hledání ani filtrům neodpovídá žádný úkol.",
      }}
    />
  )
}

const VIEW_EMPTY: Readonly<Record<TicketView, { title: string; description: string }>> = {
  otevrene: { title: "Čisto", description: "Žádné otevřené úkoly." },
  "po-terminu": { title: "Nic po termínu", description: "Všechno máš v termínu." },
  dnes: { title: "Na dnešek nic", description: "Žádný úkol s termínem na dnešek." },
  tyden: { title: "Tento týden nic", description: "Žádný úkol s termínem do konce týdne." },
  "bez-terminu": { title: "Vše má termín", description: "Žádný otevřený úkol bez termínu." },
  hotove: { title: "Zatím nic hotového", description: "Žádný dokončený úkol." },
}

function TicketsBulkActions({
  orgSlug,
  selectedIds,
  priorityOptions,
  assigneeOptions,
  onDone,
  onComplete,
}: {
  orgSlug: string
  selectedIds: string[]
  priorityOptions: EnumOption[]
  assigneeOptions: BrowserFilterOption[]
  onDone: () => void
  onComplete: (ids: string[]) => void
}) {
  const { toast } = useToast()
  const { toastWithUndo } = useUndoToast()
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [priorityOpen, setPriorityOpen] = useState(false)
  const [assignOpen, setAssignOpen] = useState(false)
  const [pickedUserIds, setPickedUserIds] = useState<ReadonlySet<string>>(new Set())

  const run = (action: () => Promise<ActionState>, optimistic?: () => void) => {
    startTransition(async () => {
      optimistic?.()
      const result = await action()
      if (result.status === "success") {
        toastWithUndo(result, () => router.refresh())
        onDone()
        router.refresh()
      } else if (result.status === "error") {
        toast({ variant: "error", title: result.message })
      }
    })
  }

  const togglePickedUser = (userId: string) => {
    setPickedUserIds((prev) => {
      const next = new Set(prev)
      if (next.has(userId)) {
        next.delete(userId)
      } else {
        next.add(userId)
      }
      return next
    })
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        disabled={pending}
        onClick={() =>
          run(
            () => bulkCompleteTicketsAction(orgSlug, selectedIds),
            () => onComplete(selectedIds),
          )
        }
        className="cursor-pointer"
      >
        <CheckCircle2 className="size-4" />
        Dokončit
      </Button>
      <Popover open={priorityOpen} onOpenChange={setPriorityOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" disabled={pending} className="cursor-pointer">
            <Flag className="size-4" />
            Priorita
          </Button>
        </PopoverTrigger>
        <PopoverContent align="center" side="top" className="w-auto p-1">
          <div className="flex min-w-40 flex-col gap-0.5">
            {priorityOptions.map((option) => {
              const optionStyle = optionBadgeStyle(option)
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    setPriorityOpen(false)
                    run(() => bulkSetTicketPriorityAction(orgSlug, selectedIds, option.value))
                  }}
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm text-foreground transition-colors hover:bg-surface-2"
                >
                  <span aria-hidden className={cn("size-[7px] shrink-0 rounded-full", optionStyle.dot)} />
                  {optionStyle.label}
                </button>
              )
            })}
          </div>
        </PopoverContent>
      </Popover>
      <Popover
        open={assignOpen}
        onOpenChange={(open) => {
          setAssignOpen(open)
          if (open) {
            setPickedUserIds(new Set())
          }
        }}
      >
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" disabled={pending} className="cursor-pointer">
            <UserPlus className="size-4" />
            Přiřadit
          </Button>
        </PopoverTrigger>
        <PopoverContent align="center" side="top" className="w-auto p-1.5">
          <div className="flex max-h-72 min-w-52 flex-col gap-0.5 overflow-y-auto">
            {assigneeOptions.map((option) => (
              <label
                key={option.value}
                className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm text-foreground transition-colors hover:bg-surface-2"
              >
                <Checkbox
                  checked={pickedUserIds.has(option.value)}
                  onCheckedChange={() => togglePickedUser(option.value)}
                  className="h-4 w-4"
                />
                <span className="truncate">{option.label}</span>
              </label>
            ))}
          </div>
          <div className="mt-1.5 border-t border-hairline pt-1.5">
            <Button
              size="sm"
              disabled={pending || pickedUserIds.size === 0}
              onClick={() => {
                setAssignOpen(false)
                run(() => bulkAssignTicketsAction(orgSlug, selectedIds, [...pickedUserIds]))
              }}
              className="w-full cursor-pointer"
            >
              Přiřadit
            </Button>
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
        title="Smazat vybrané úkoly"
        description={`Vybrané úkoly (${selectedIds.length}) budou smazány včetně podúkolů.`}
        confirmLabel="Smazat"
        destructive
        onConfirm={async () => {
          const result = await bulkDeleteTicketsAction(orgSlug, selectedIds)
          if (result.status === "success") {
            toastWithUndo(result, () => router.refresh())
            onDone()
            router.refresh()
          } else if (result.status === "error") {
            toast({ variant: "error", title: result.message })
          }
        }}
      />
    </>
  )
}

function Pill({ style, bold }: { style: BadgeStyle; bold?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium",
        style.badge,
        bold && "font-semibold",
      )}
    >
      <span aria-hidden className={cn("size-[7px] shrink-0 rounded-full", style.dot)} />
      {style.label}
    </span>
  )
}

function TitleQuickEdit({ ticket, orgSlug }: { ticket: TicketListItem; orgSlug: string }) {
  const { toast } = useToast()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(ticket.title)
  const [, startTransition] = useTransition()
  const [optimisticTitle, setOptimisticTitle] = useOptimistic(ticket.title)

  const start = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation()
    setValue(optimisticTitle)
    setEditing(true)
  }

  const commit = () => {
    setEditing(false)
    const next = value.trim()
    if (next.length === 0 || next === optimisticTitle) {
      setValue(optimisticTitle)
      return
    }
    startTransition(async () => {
      setOptimisticTitle(next)
      const result = await patchTaskAction(orgSlug, {
        ticketId: ticket.id,
        patch: { title: next },
      })
      if (result.status === "error") {
        toast({ variant: "error", title: result.message })
      }
    })
  }

  if (editing) {
    return (
      <input
        autoFocus
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onFocus={(event) => event.currentTarget.select()}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          event.stopPropagation()
          if (event.key === "Enter") {
            event.preventDefault()
            commit()
          } else if (event.key === "Escape") {
            event.preventDefault()
            setEditing(false)
            setValue(optimisticTitle)
          }
        }}
        onBlur={commit}
        className="w-full min-w-0 rounded-md border border-border-strong/60 bg-surface px-1.5 py-0.5 text-[13px] font-semibold text-foreground focus-visible:border-primary focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/20"
      />
    )
  }

  return (
    <button
      type="button"
      onClick={start}
      className="-mx-1 cursor-text rounded-md px-1 py-0.5 text-left text-[13px] font-semibold text-foreground transition-colors hover:bg-surface-2"
    >
      {optimisticTitle}
    </button>
  )
}

function StatusQuickEdit({
  ticket,
  orgSlug,
  statusOptions,
  statusStyles,
  onStatusChange,
}: {
  ticket: TicketListItem
  orgSlug: string
  statusOptions: EnumOption[]
  statusStyles: Record<string, BadgeStyle>
  onStatusChange: (ticketId: string, nextStatus: string) => void
}) {
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [, startTransition] = useTransition()
  const [optimisticStatus, setOptimisticStatus] = useOptimistic(ticket.status)
  const style = badgeStyleFor(optimisticStatus, statusStyles)

  const select = (status: string) => {
    setOpen(false)
    if (status === optimisticStatus) {
      return
    }
    startTransition(async () => {
      setOptimisticStatus(status)
      onStatusChange(ticket.id, status)
      const result = await quickSetTicketStatusAction(orgSlug, {
        ticketId: ticket.id,
        status,
      })
      if (result.status === "error") {
        toast({ variant: "error", title: result.message })
      }
    })
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(event) => event.stopPropagation()}
          aria-label={`Změnit status, aktuálně ${style.label}`}
          className="cursor-pointer rounded-full transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/20"
        >
          <Pill style={style} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-1">
        <div className="flex min-w-40 flex-col gap-0.5">
          {statusOptions.map((option) => {
            const optionStyle = optionBadgeStyle(option)
            const active = option.value === optimisticStatus
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => select(option.value)}
                className={cn(
                  "flex cursor-pointer items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors",
                  active ? "bg-primary-soft text-primary" : "text-foreground hover:bg-surface-2",
                )}
              >
                <span className="flex items-center gap-2">
                  <span aria-hidden className={cn("size-[7px] shrink-0 rounded-full", optionStyle.dot)} />
                  {optionStyle.label}
                </span>
                {active ? <Check className="size-4 shrink-0" /> : null}
              </button>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}

function DoneQuickToggle({
  ticket,
  orgSlug,
  doneValue,
  reopenValue,
  onStatusChange,
}: {
  ticket: TicketListItem
  orgSlug: string
  doneValue: string
  reopenValue: string
  onStatusChange: (ticketId: string, nextStatus: string) => void
}) {
  const { toast } = useToast()
  const [, startTransition] = useTransition()
  // Optimistic checked state: flips instantly, reverts to the server-provided
  // status when the transition ends (fresh rows arrive via revalidatePath).
  const [optimisticDone, setOptimisticDone] = useOptimistic(ticket.status === doneValue)
  const toggle = () => {
    const nextDone = !optimisticDone
    const nextStatus = nextDone ? doneValue : reopenValue
    startTransition(async () => {
      setOptimisticDone(nextDone)
      onStatusChange(ticket.id, nextStatus)
      const result = await quickSetTicketStatusAction(orgSlug, {
        ticketId: ticket.id,
        status: nextStatus,
      })
      if (result.status === "error") {
        toast({ variant: "error", title: result.message })
      }
    })
  }
  return (
    <span onClick={(event) => event.stopPropagation()}>
      <Checkbox checked={optimisticDone} onCheckedChange={toggle} />
    </span>
  )
}

function PriorityQuickEdit({
  ticket,
  orgSlug,
  priorityOptions,
  priorityStyles,
}: {
  ticket: TicketListItem
  orgSlug: string
  priorityOptions: EnumOption[]
  priorityStyles: Record<string, BadgeStyle>
}) {
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [, startTransition] = useTransition()
  const [optimisticPriority, setOptimisticPriority] = useOptimistic(ticket.priority)
  const current = priorityOptions.find((option) => option.value === optimisticPriority)
  const style = badgeStyleFor(optimisticPriority, priorityStyles)
  const loud = current?.semantic === "critical" || current?.semantic === "high"

  const select = (priority: string) => {
    setOpen(false)
    if (priority === optimisticPriority) {
      return
    }
    startTransition(async () => {
      setOptimisticPriority(priority)
      const result = await quickEditTicketAction(orgSlug, {
        ticketId: ticket.id,
        title: ticket.title,
        description: ticket.description ?? "",
        priority,
        status: ticket.status,
        dueAt: ticket.dueAt ?? "",
        labels: ticket.labels,
      })
      if (result.status === "error") {
        toast({ variant: "error", title: result.message })
      }
    })
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(event) => event.stopPropagation()}
          aria-label={`Změnit prioritu, aktuálně ${style.label}`}
          className="cursor-pointer rounded-full transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/20"
        >
          <Pill style={style} bold={loud} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-1">
        <div className="flex min-w-40 flex-col gap-0.5">
          {priorityOptions.map((option) => {
            const optionStyle = optionBadgeStyle(option)
            const active = option.value === optimisticPriority
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => select(option.value)}
                className={cn(
                  "flex cursor-pointer items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors",
                  active ? "bg-primary-soft text-primary" : "text-foreground hover:bg-surface-2",
                )}
              >
                <span className="flex items-center gap-2">
                  <span aria-hidden className={cn("size-[7px] shrink-0 rounded-full", optionStyle.dot)} />
                  {optionStyle.label}
                </span>
                {active ? <Check className="size-4 shrink-0" /> : null}
              </button>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}

function DueQuickEdit({
  ticket,
  today,
  orgSlug,
}: {
  ticket: TicketListItem
  today: string
  orgSlug: string
}) {
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [, startTransition] = useTransition()
  const [optimisticDue, setOptimisticDue] = useOptimistic(ticket.dueAt)
  // isOverdue comes precomputed from the server; recompute only while showing
  // an optimistic date that differs from the server row.
  const overdue =
    optimisticDue === ticket.dueAt
      ? ticket.isOverdue
      : optimisticDue !== undefined && optimisticDue < today

  const apply = (iso: string) => {
    setOpen(false)
    if (iso === (optimisticDue ?? "")) {
      return
    }
    startTransition(async () => {
      setOptimisticDue(iso.length > 0 ? iso : undefined)
      const result = await quickEditTicketAction(orgSlug, {
        ticketId: ticket.id,
        title: ticket.title,
        description: ticket.description ?? "",
        priority: ticket.priority,
        status: ticket.status,
        dueAt: iso,
        labels: ticket.labels,
      })
      if (result.status === "error") {
        toast({ variant: "error", title: result.message })
      }
    })
  }

  const todayDate = parseISO(today)
  const presets: Array<{ label: string; iso: string }> = [
    { label: "Dnes", iso: today },
    { label: "Zítra", iso: format(addDays(todayDate, 1), "yyyy-MM-dd") },
    { label: "Za týden", iso: format(addDays(todayDate, 7), "yyyy-MM-dd") },
  ]

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(event) => event.stopPropagation()}
          aria-label={
            optimisticDue !== undefined ? `Změnit termín ${formatCzechDate(optimisticDue)}` : "Přidat termín"
          }
          className={cn(
            "inline-flex cursor-pointer items-center gap-1 rounded-lg px-2 py-1 transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/20",
            optimisticDue === undefined && "text-muted-soft hover:text-foreground",
          )}
        >
          {optimisticDue !== undefined ? (
            <span
              className={cn(
                "inline-flex items-center gap-1",
                overdue ? "font-medium text-red-text" : "text-muted",
              )}
            >
              {overdue ? <CalendarClock className="size-3" /> : null}
              {formatCzechDate(optimisticDue)}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[13px]">
              <CalendarPlus className="size-3.5" />
              Termín
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-2">
        <div className="flex min-w-48 flex-col gap-0.5">
          {presets.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => apply(preset.iso)}
              className="flex cursor-pointer items-center justify-between gap-3 rounded-lg px-2.5 py-1.5 text-left text-sm text-foreground transition-colors hover:bg-surface-2"
            >
              <span>{preset.label}</span>
              <span className="text-xs tabular-nums text-muted-soft">{formatCzechDate(preset.iso)}</span>
            </button>
          ))}
          <div className="my-1 h-px bg-border" />
          <DatePicker value={optimisticDue ?? null} onChange={(iso) => apply(iso)} placeholder="Jiné datum" />
          {optimisticDue !== undefined ? (
            <button
              type="button"
              onClick={() => apply("")}
              className="mt-1 flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
            >
              <X className="size-3.5" />
              Vymazat termín
            </button>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  )
}
