"use client"

import { useCallback, useEffect, useRef, useState, useTransition } from "react"
import type { ReactNode } from "react"
import {
  draggable,
  dropTargetForElements,
  monitorForElements,
} from "@atlaskit/pragmatic-drag-and-drop/element/adapter"
import { combine } from "@atlaskit/pragmatic-drag-and-drop/combine"
import {
  attachClosestEdge,
  extractClosestEdge,
} from "@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge"
import { Check, ListChecks, MoreHorizontal, Plus } from "lucide-react"
import { Button } from "@/app/_ui/Button"
import { EmptyState } from "@/app/_ui/EmptyState"
import { Popover, PopoverContent, PopoverTrigger } from "@/app/_ui/Popover"
import { ToastVariant, useToast } from "@/app/_ui/Toast"
import { useTaskDetail } from "@/app/_components/task-detail/TaskDetailProvider"
import { AvatarStack } from "@/app/_components/AvatarStack"
import { useOrg } from "@/app/_components/org/OrgProvider"
import { badgeStyleFor, optionBadgeStyle, styleMap, type BadgeStyle } from "@/lib/crm/config"
import { cn } from "@/lib/cn"
import type { EnumOption, TicketWithAssignees } from "@/core/types/crm.types"
import { changeTicketStatusAction, reorderTicketAction } from "../actions"
import { DueTag, PriorityTag, SubtaskBadge } from "./ticketBits"

const isLoudPriority = (option: EnumOption | undefined): boolean =>
  option?.semantic === "critical" || option?.semantic === "high"

interface TicketBoardProps {
  projectId: string
  tickets: TicketWithAssignees[]
  statusOptions: EnumOption[]
  priorityOptions: EnumOption[]
  doneValue: string
  backlogValue: string
}

interface DropHint {
  status: string
  index: number
}

const ticketCardKey = Symbol("ticketCard")

type TicketCardData = {
  [ticketCardKey]: true
  ticketId: string
  status: string
  index: number
}

const ticketCardData = (data: Omit<TicketCardData, typeof ticketCardKey>): TicketCardData => ({
  [ticketCardKey]: true,
  ...data,
})

const isTicketCardData = (data: Record<string | symbol, unknown>): data is TicketCardData =>
  data[ticketCardKey] === true

const columnDropKey = Symbol("ticketColumn")

type ColumnDropData = {
  [columnDropKey]: true
  status: string
}

const columnDropData = (data: Omit<ColumnDropData, typeof columnDropKey>): ColumnDropData => ({
  [columnDropKey]: true,
  ...data,
})

const isColumnDropData = (data: Record<string | symbol, unknown>): data is ColumnDropData =>
  data[columnDropKey] === true

interface DropTargetLike {
  data: Record<string | symbol, unknown>
}

interface ResolvedDrop {
  status: string
  index: number
  onSource: boolean
}

// Drop targets are innermost-first, so a card target wins over its column;
// top edge inserts before the card, bottom edge after, column body at the end.
const resolveDropPosition = (
  sourceTicketId: string,
  dropTargets: readonly DropTargetLike[],
  columnLength: (status: string) => number,
): ResolvedDrop | null => {
  for (const target of dropTargets) {
    if (isTicketCardData(target.data)) {
      const edge = extractClosestEdge(target.data)

      return {
        status: target.data.status,
        index: target.data.index + (edge === "bottom" ? 1 : 0),
        onSource: target.data.ticketId === sourceTicketId,
      }
    }

    if (isColumnDropData(target.data)) {
      return {
        status: target.data.status,
        index: columnLength(target.data.status),
        onSource: false,
      }
    }
  }

  return null
}

export function TicketBoard({
  projectId,
  tickets,
  statusOptions,
  priorityOptions,
  doneValue,
  backlogValue,
}: TicketBoardProps) {
  const { toast } = useToast()
  const { openTask, createTask } = useTaskDetail()
  const { orgSlug } = useOrg()
  const [, startTransition] = useTransition()
  // Local mirror so a drag reorders the board immediately; server revalidation
  // flows back through props and resets this to the persisted truth.
  const [localTickets, setLocalTickets] = useState<TicketWithAssignees[]>(tickets)
  const [dragId, setDragId] = useState<string | null>(null)
  const [dropHint, setDropHint] = useState<DropHint | null>(null)

  const priorityByValue = new Map(priorityOptions.map((option) => [option.value, option]))
  const priorityStyles = styleMap(priorityOptions)

  useEffect(() => {
    setLocalTickets(tickets)
  }, [tickets])

  const parents = localTickets.filter((ticket) => ticket.parentId === undefined)
  const subtasksOf = (parentId: string): TicketWithAssignees[] =>
    localTickets.filter((ticket) => ticket.parentId === parentId).sort((a, b) => a.order - b.order)
  const columnParents = (status: string): TicketWithAssignees[] =>
    parents.filter((ticket) => ticket.status === status).sort((a, b) => a.order - b.order)

  const runStatusChange = (ticketId: string, status: string) => {
    const current = localTickets.find((ticket) => ticket.id === ticketId)
    if (current === undefined || current.status === status) {
      return
    }

    const previous = localTickets
    const nowIso = new Date().toISOString()
    setLocalTickets((prev) =>
      prev.map((ticket) =>
        ticket.id === ticketId
          ? {
              ...ticket,
              status,
              doneAt: status === doneValue ? ticket.doneAt ?? nowIso : undefined,
            }
          : ticket,
      ),
    )
    startTransition(async () => {
      const result = await changeTicketStatusAction(orgSlug, { ticketId, status, projectId })
      if (result.status === "error") {
        setLocalTickets(previous)
        toast({ variant: ToastVariant.Error, title: result.message })
      }
    })
  }

  const applyReorder = (ticketId: string, status: string, dropIndex: number) => {
    const dest = columnParents(status)
    const originalIndex = dest.findIndex((ticket) => ticket.id === ticketId)
    // dropIndex counts against the column as shown (dragged card still visible),
    // so if the card starts above the drop point in the same column, shift down one.
    const insertAt = originalIndex !== -1 && originalIndex < dropIndex ? dropIndex - 1 : dropIndex
    const orderedIds = dest.filter((ticket) => ticket.id !== ticketId).map((ticket) => ticket.id)
    orderedIds.splice(insertAt, 0, ticketId)

    const previous = localTickets
    const nextOrder = new Map(orderedIds.map((id, index) => [id, index]))
    const nowIso = new Date().toISOString()
    const next = localTickets.map((ticket) => {
      if (ticket.id === ticketId) {
        return {
          ...ticket,
          status,
          order: nextOrder.get(ticketId) ?? ticket.order,
          doneAt: status === doneValue ? ticket.doneAt ?? nowIso : undefined,
        }
      }

      const reordered = nextOrder.get(ticket.id)

      return reordered !== undefined ? { ...ticket, order: reordered } : ticket
    })
    setLocalTickets(next)

    startTransition(async () => {
      const result = await reorderTicketAction(orgSlug, { ticketId, status, orderedIds, projectId })
      if (result.status === "error") {
        setLocalTickets(previous)
        toast({ variant: ToastVariant.Error, title: result.message })
      }
    })
  }

  const clearDrag = useCallback(() => {
    setDragId(null)
    setDropHint(null)
  }, [])

  // The monitor registers once; these refs keep its callbacks reading the
  // current column state instead of the closure from the registration render.
  const applyReorderRef = useRef(applyReorder)
  const columnLengthRef = useRef((status: string) => columnParents(status).length)
  useEffect(() => {
    applyReorderRef.current = applyReorder
    columnLengthRef.current = (status: string) => columnParents(status).length
  })

  useEffect(() => {
    return monitorForElements({
      canMonitor: ({ source }) => isTicketCardData(source.data),
      onDrag: ({ source, location }) => {
        if (!isTicketCardData(source.data)) {
          return
        }

        const resolved = resolveDropPosition(
          source.data.ticketId,
          location.current.dropTargets,
          columnLengthRef.current,
        )
        const nextHint =
          resolved !== null && !resolved.onSource
            ? { status: resolved.status, index: resolved.index }
            : null
        setDropHint((current) =>
          current !== null &&
          nextHint !== null &&
          current.status === nextHint.status &&
          current.index === nextHint.index
            ? current
            : nextHint,
        )
      },
      onDrop: ({ source, location }) => {
        setDropHint(null)
        if (!isTicketCardData(source.data)) {
          return
        }

        const resolved = resolveDropPosition(
          source.data.ticketId,
          location.current.dropTargets,
          columnLengthRef.current,
        )
        if (resolved !== null) {
          applyReorderRef.current(source.data.ticketId, resolved.status, resolved.index)
        }
      },
    })
  }, [])

  return (
    <div data-wide>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-[15px] font-semibold text-foreground">Úkoly</h2>
        {localTickets.length > 0 ? (
          <Button size="sm" onClick={() => createTask({ projectId, status: backlogValue })}>
            <Plus className="size-4" />
            Nový úkol
          </Button>
        ) : null}
      </div>

      {localTickets.length === 0 ? (
        <div className="rounded-2xl border border-hairline bg-surface shadow-soft">
          <EmptyState
            icon={<ListChecks className="size-6" />}
            title="Zatím žádné úkoly"
            description="Rozpadněte projekt na úkoly, ať vidíte, co je hotové a co zbývá."
            action={
              <Button size="sm" onClick={() => createTask({ projectId, status: backlogValue })}>
                <Plus className="size-4" />
                Nový úkol
              </Button>
            }
          />
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-2">
          {statusOptions.map((option) => {
            const status = option.value
            const columnTickets = columnParents(status)
            const style = optionBadgeStyle(option)
            const showEndHint = dropHint?.status === status && dropHint.index >= columnTickets.length

            return (
              <section key={status} className="flex w-72 shrink-0 flex-col gap-3">
                <header className="flex items-center gap-2 px-1">
                  <span aria-hidden className={cn("size-[7px] rounded-full", style.dot)} />
                  <span className="text-[13px] font-semibold text-foreground">{style.label}</span>
                  <span className="rounded-full bg-surface-3/70 px-2 py-0.5 text-[11px] font-medium tabular-nums text-muted">
                    {columnTickets.length}
                  </span>
                </header>

                <ColumnDropZone status={status}>
                  {columnTickets.length === 0 && !showEndHint ? (
                    <p className="px-2 py-6 text-center text-xs text-muted-soft">Žádné úkoly</p>
                  ) : (
                    columnTickets.map((ticket, index) => {
                      const subtasks = subtasksOf(ticket.id)
                      const doneSubtasks = subtasks.filter((s) => s.status === doneValue).length
                      const showHintBefore = dropHint?.status === status && dropHint.index === index

                      return (
                        <div key={ticket.id} className="flex flex-col gap-2.5">
                          {showHintBefore ? <DropLine /> : null}
                          <TicketCard
                            ticket={ticket}
                            status={status}
                            index={index}
                            dragging={dragId === ticket.id}
                            subtasks={subtasks}
                            doneSubtasks={doneSubtasks}
                            doneValue={doneValue}
                            priorityStyle={badgeStyleFor(ticket.priority, priorityStyles)}
                            priorityLoud={isLoudPriority(priorityByValue.get(ticket.priority))}
                            statusOptions={statusOptions}
                            onOpen={openTask}
                            onStatusSelect={runStatusChange}
                            onDragStart={setDragId}
                            onDragEnd={clearDrag}
                          />
                        </div>
                      )
                    })
                  )}
                  {showEndHint ? <DropLine /> : null}
                  <button
                    type="button"
                    onClick={() => createTask({ projectId, status })}
                    className="flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1.5 text-[13px] text-muted-soft transition-colors hover:bg-surface-2 hover:text-foreground"
                  >
                    <Plus className="size-3.5" />
                    Přidat úkol
                  </button>
                </ColumnDropZone>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}

interface ColumnDropZoneProps {
  status: string
  children: ReactNode
}

function ColumnDropZone({ status, children }: ColumnDropZoneProps) {
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const element = ref.current
    if (element === null) {
      return
    }

    return dropTargetForElements({
      element,
      canDrop: ({ source }) => isTicketCardData(source.data),
      getData: () => columnDropData({ status }),
    })
  }, [status])

  return (
    <div ref={ref} className="flex min-h-24 flex-col gap-2.5 rounded-2xl bg-surface-2/50 p-2.5">
      {children}
    </div>
  )
}

interface TicketCardProps {
  ticket: TicketWithAssignees
  status: string
  index: number
  dragging: boolean
  subtasks: TicketWithAssignees[]
  doneSubtasks: number
  doneValue: string
  priorityStyle: BadgeStyle
  priorityLoud: boolean
  statusOptions: EnumOption[]
  onOpen: (ticketId: string) => void
  onStatusSelect: (ticketId: string, status: string) => void
  onDragStart: (ticketId: string) => void
  onDragEnd: () => void
}

function TicketCard({
  ticket,
  status,
  index,
  dragging,
  subtasks,
  doneSubtasks,
  doneValue,
  priorityStyle,
  priorityLoud,
  statusOptions,
  onOpen,
  onStatusSelect,
  onDragStart,
  onDragEnd,
}: TicketCardProps) {
  const ref = useRef<HTMLElement | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const ticketId = ticket.id

  useEffect(() => {
    const element = ref.current
    if (element === null) {
      return
    }

    return combine(
      draggable({
        element,
        canDrag: () => !menuOpen,
        getInitialData: () => ticketCardData({ ticketId, status, index }),
        onDragStart: () => onDragStart(ticketId),
        onDrop: () => onDragEnd(),
      }),
      dropTargetForElements({
        element,
        canDrop: ({ source }) => isTicketCardData(source.data),
        getIsSticky: () => true,
        getData: ({ input, element: target }) =>
          attachClosestEdge(ticketCardData({ ticketId, status, index }), {
            input,
            element: target,
            allowedEdges: ["top", "bottom"],
          }),
      }),
    )
  }, [ticketId, status, index, menuOpen, onDragStart, onDragEnd])

  return (
    <article
      ref={ref}
      onClick={() => onOpen(ticketId)}
      className={cn(
        "group cursor-pointer rounded-xl border border-hairline bg-surface p-3 shadow-soft transition-shadow hover:shadow-lifted",
        dragging && "opacity-40",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[13px] font-medium leading-snug text-foreground">{ticket.title}</p>
        <StatusMenu
          current={ticket.status}
          statusOptions={statusOptions}
          onSelect={(next) => onStatusSelect(ticketId, next)}
          open={menuOpen}
          onOpenChange={setMenuOpen}
        />
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <PriorityTag style={priorityStyle} loud={priorityLoud} />
        <DueTag dueAt={ticket.dueAt} done={ticket.status === doneValue} />
        {subtasks.length > 0 ? <SubtaskBadge done={doneSubtasks} total={subtasks.length} /> : null}
        {ticket.assignees.length > 0 ? (
          <AvatarStack members={ticket.assignees} className="ml-auto" />
        ) : null}
      </div>
    </article>
  )
}

function DropLine() {
  return <div className="h-0.5 rounded-full bg-primary/70" />
}

interface StatusMenuProps {
  current: string
  statusOptions: EnumOption[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (status: string) => void
}

function StatusMenu({ current, statusOptions, open, onOpenChange, onSelect }: StatusMenuProps) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Změnit stav úkolu"
          onClick={(event) => event.stopPropagation()}
          className="flex size-6 shrink-0 items-center justify-center rounded-full text-muted-soft/70 opacity-0 transition-colors hover:bg-surface-3/60 hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100"
        >
          <MoreHorizontal className="size-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-auto p-1"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex min-w-44 flex-col gap-0.5">
          <span className="px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-soft">
            Přesunout do
          </span>
          {statusOptions.map((option) => {
            const style = optionBadgeStyle(option)
            const active = option.value === current

            return (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onSelect(option.value)
                  onOpenChange(false)
                }}
                className={cn(
                  "flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors",
                  active ? "bg-primary-soft text-primary" : "text-foreground hover:bg-surface-2",
                )}
              >
                <span className="flex items-center gap-2">
                  <span aria-hidden className={cn("size-[7px] rounded-full", style.dot)} />
                  {style.label}
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
