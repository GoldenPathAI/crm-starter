"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowRight,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  MoreHorizontal,
  Plus,
  ThumbsDown,
  Trophy,
} from "lucide-react"
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
import { optionBadgeStyle } from "@/lib/crm/config"
import { orgHref } from "@/lib/nav"
import { useOrg } from "@/app/_components/org/OrgProvider"
import { AvatarStack } from "@/app/_components/AvatarStack"
import { Button } from "@/app/_ui/Button"
import { Dialog, DialogContent } from "@/app/_ui/Dialog"
import { Textarea } from "@/app/_ui/Textarea"
import { Popover, PopoverContent, PopoverTrigger } from "@/app/_ui/Popover"
import { useToast } from "@/app/_ui/Toast"
import { useUndoToast } from "@/app/_lib/useUndoToast"
import { cn } from "@/lib/cn"
import { formatCzechDate } from "@/lib/dates"
import type { DealStage, EnumOption, OrgMember } from "@/core/types/crm.types"
import type { DealCard, DealStageColumn } from "@/lib/crm/store/deals"
import {
  deleteDealAction,
  markDealLostAction,
  moveDealStageAction,
  reorderDealAction,
  setDealAssigneesAction,
  updateDealNextStepAction,
} from "../actions"
import { formatCzk, formatCzkCompact, formatDaysInStage, formatPercent, formatShortDate } from "../_lib/format"
import { DealDetail, LostDialog, StageMoveList, WonDialog } from "./dealDetail"

const isClosedSemantic = (semantic: string | undefined): boolean =>
  semantic === "won" || semantic === "lost"

const dealCardKey = Symbol("pipelineDealCard")

type DealCardDragData = {
  [dealCardKey]: true
  dealId: string
  stage: DealStage
  index: number
}

const dealCardData = (data: Omit<DealCardDragData, typeof dealCardKey>): DealCardDragData => ({
  [dealCardKey]: true,
  ...data,
})

const isDealCardData = (data: Record<string | symbol, unknown>): data is DealCardDragData =>
  data[dealCardKey] === true

const stageDropKey = Symbol("pipelineStageDrop")

type StageDropData = {
  [stageDropKey]: true
  stage: DealStage
}

const stageDropData = (data: Omit<StageDropData, typeof stageDropKey>): StageDropData => ({
  [stageDropKey]: true,
  ...data,
})

const isStageDropData = (data: Record<string | symbol, unknown>): data is StageDropData =>
  data[stageDropKey] === true

interface DropHint {
  stage: DealStage
  index: number
}

interface DropTargetLike {
  data: Record<string | symbol, unknown>
}

interface ResolvedDrop {
  stage: DealStage
  index: number
  onSource: boolean
}

// Drop targets come innermost-first, so a card target wins over its column:
// the top edge inserts before the card, the bottom edge after, the column body
// lands at the end.
const resolveDropPosition = (
  sourceDealId: string,
  dropTargets: readonly DropTargetLike[],
  columnLength: (stage: DealStage) => number,
): ResolvedDrop | null => {
  for (const target of dropTargets) {
    if (isDealCardData(target.data)) {
      const edge = extractClosestEdge(target.data)

      return {
        stage: target.data.stage,
        index: target.data.index + (edge === "bottom" ? 1 : 0),
        onSource: target.data.dealId === sourceDealId,
      }
    }

    if (isStageDropData(target.data)) {
      return {
        stage: target.data.stage,
        index: columnLength(target.data.stage),
        onSource: false,
      }
    }
  }

  return null
}

const DropLine = () => <div className="h-0.5 rounded-full bg-primary/70" />

const useStageDropTarget = (
  stage: DealStage,
  setDragOverStage: (stage: DealStage | null) => void,
) => {
  const ref = useRef<HTMLElement | null>(null)
  useEffect(() => {
    const element = ref.current
    if (element === null) {
      return
    }

    return dropTargetForElements({
      element,
      canDrop: ({ source }) => isDealCardData(source.data),
      getData: () => stageDropData({ stage }),
      onDragEnter: () => setDragOverStage(stage),
      onDragLeave: () => setDragOverStage(null),
      onDrop: () => setDragOverStage(null),
    })
  }, [stage, setDragOverStage])

  return ref
}

const useDealCardDraggable = (
  dealId: string,
  stage: DealStage,
  index: number,
  canDrag: boolean,
  setDraggingId: (id: string | null) => void,
) => {
  const ref = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const element = ref.current
    if (element === null) {
      return
    }

    return combine(
      draggable({
        element,
        getInitialData: () => dealCardData({ dealId, stage, index }),
        canDrag: () => canDrag,
        onDragStart: () => setDraggingId(dealId),
        onDrop: () => setDraggingId(null),
      }),
      dropTargetForElements({
        element,
        canDrop: ({ source }) => isDealCardData(source.data),
        getIsSticky: () => true,
        getData: ({ input, element: target }) =>
          attachClosestEdge(dealCardData({ dealId, stage, index }), {
            input,
            element: target,
            allowedEdges: ["top", "bottom"],
          }),
      }),
    )
  }, [dealId, stage, index, canDrag, setDraggingId])

  return ref
}

interface ColumnAccent {
  header: string
  label: string
  count: string
  body: string
  card: string
}

const columnAccent = (semantic: string | undefined): ColumnAccent => {
  if (semantic === "won") {
    return {
      header: "bg-green-soft/70",
      label: "text-green-text",
      count: "bg-green/15 text-green-text",
      body: "bg-green-soft/25",
      card: "bg-surface/80",
    }
  }

  if (semantic === "lost") {
    return {
      header: "bg-red-soft/70",
      label: "text-red-text",
      count: "bg-red/15 text-red-text",
      body: "bg-red-soft/20",
      card: "bg-surface/80",
    }
  }

  return {
    header: "bg-surface-2",
    label: "text-foreground",
    count: "bg-surface-3/80 text-muted",
    body: "bg-surface-2/50",
    card: "bg-surface",
  }
}

const recomputeColumn = (column: DealStageColumn, deals: DealCard[]): DealStageColumn => ({
  ...column,
  deals,
  count: deals.length,
  sumCzk: deals.reduce((sum, deal) => sum + deal.valueCzk, 0),
})

const applyMove = (
  board: DealStageColumn[],
  dealId: string,
  toStage: DealStage,
): DealStageColumn[] => {
  const source = board.find((column) => column.deals.some((deal) => deal.id === dealId))
  const moving = source?.deals.find((deal) => deal.id === dealId)
  if (source === undefined || moving === undefined || source.stage === toStage) {
    return board
  }

  const movedCard: DealCard = {
    ...moving,
    stage: toStage,
    daysInStage: 0,
    isStale: false,
  }

  return board.map((column) => {
    if (column.stage === source.stage) {
      return recomputeColumn(
        column,
        column.deals.filter((deal) => deal.id !== dealId),
      )
    }

    if (column.stage === toStage) {
      const deals = [...column.deals, movedCard].sort((a, b) => b.valueCzk - a.valueCzk)

      return recomputeColumn(column, deals)
    }

    return column
  })
}

const applyNextStep = (
  board: DealStageColumn[],
  dealId: string,
  nextStep: string | undefined,
): DealStageColumn[] =>
  board.map((column) => ({
    ...column,
    deals: column.deals.map((deal) => (deal.id === dealId ? { ...deal, nextStep } : deal)),
  }))

const applyAssignees = (
  board: DealStageColumn[],
  dealId: string,
  assignees: OrgMember[],
): DealStageColumn[] =>
  board.map((column) => ({
    ...column,
    deals: column.deals.map((deal) => (deal.id === dealId ? { ...deal, assignees } : deal)),
  }))

// Strips the ?deal= deep-link param (set by notification links) so a refresh
// after closing the detail does not reopen it.
const clearDealParam = (): void => {
  const url = new URL(window.location.href)
  if (url.searchParams.has("deal")) {
    url.searchParams.delete("deal")
    window.history.replaceState(null, "", url.toString())
  }
}

export function PipelineBoard({
  columns,
  stageOptions,
  members,
  initialOpenDealId,
}: {
  columns: DealStageColumn[]
  stageOptions: EnumOption[]
  members: OrgMember[]
  initialOpenDealId?: string
}) {
  const { toast } = useToast()
  const { toastWithUndo } = useUndoToast()
  const { orgSlug } = useOrg()
  const router = useRouter()
  const optionByValue = new Map(stageOptions.map((option) => [option.value, option]))
  const wonStage = stageOptions.find((option) => option.semantic === "won")?.value
  const lostStage = stageOptions.find((option) => option.semantic === "lost")?.value
  const isClosedStage = (stage: DealStage): boolean =>
    isClosedSemantic(optionByValue.get(stage)?.semantic)
  const [, startTransition] = useTransition()
  const [board, setBoard] = useState<DealStageColumn[]>(columns)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverStage, setDragOverStage] = useState<DealStage | null>(null)
  const [dropHint, setDropHint] = useState<DropHint | null>(null)
  const [openDealId, setOpenDealId] = useState<string | null>(null)
  const [wonTargetId, setWonTargetId] = useState<string | null>(null)
  const [lostTargetId, setLostTargetId] = useState<string | null>(null)
  const [expandedClosed, setExpandedClosed] = useState<ReadonlyArray<DealStage>>([])

  useEffect(() => {
    setBoard(columns)
  }, [columns])

  // Deep-link: open the deal detail once on mount when ?deal= is present.
  // An unknown or foreign id just drops the param without opening anything.
  const consumedDeepLink = useRef(false)
  useEffect(() => {
    if (consumedDeepLink.current || initialOpenDealId === undefined) {
      return
    }

    consumedDeepLink.current = true
    const exists = columns.some((column) =>
      column.deals.some((deal) => deal.id === initialOpenDealId),
    )
    if (exists) {
      setOpenDealId(initialOpenDealId)
    } else {
      clearDealParam()
    }
  }, [initialOpenDealId, columns])

  const toggleClosed = (stage: DealStage) => {
    setExpandedClosed((prev) =>
      prev.includes(stage) ? prev.filter((value) => value !== stage) : [...prev, stage],
    )
  }

  const commitMove = (dealId: string, toStage: DealStage) => {
    const previous = board
    setBoard((prev) => applyMove(prev, dealId, toStage))
    startTransition(async () => {
      const result = await moveDealStageAction(orgSlug, dealId, toStage)
      if (result.status === "error") {
        toast({ variant: "error", title: result.message })
        setBoard(previous)
      }
    })
  }

  // One-click "posunout dál" from the card: same optimistic move as a drag, but with
  // the standard undo toast because the click has no drop gesture to signal intent.
  const runAdvance = (dealId: string, toStage: DealStage) => {
    const previous = board
    setBoard((prev) => applyMove(prev, dealId, toStage))
    startTransition(async () => {
      const result = await moveDealStageAction(orgSlug, dealId, toStage)
      if (result.status === "success") {
        toastWithUndo(result, () => router.refresh())
      } else if (result.status === "error") {
        toast({ variant: "error", title: result.message })
        setBoard(previous)
      }
    })
  }

  const runWin = async (dealId: string): Promise<boolean> => {
    if (wonStage === undefined) {
      return false
    }

    const previous = board
    setBoard((prev) => applyMove(prev, dealId, wonStage))
    const result = await moveDealStageAction(orgSlug, dealId, wonStage)
    if (result.status === "success") {
      toastWithUndo(result, () => router.refresh())

      return true
    }

    if (result.status === "error") {
      toast({ variant: "error", title: result.message })
      setBoard(previous)
    }

    return false
  }

  const runLost = async (dealId: string, reason: string): Promise<boolean> => {
    if (lostStage === undefined) {
      return false
    }

    const previous = board
    setBoard((prev) => applyMove(prev, dealId, lostStage))
    const result = await markDealLostAction(orgSlug, dealId, reason)
    if (result.status === "success") {
      toastWithUndo(result, () => router.refresh())

      return true
    }

    if (result.status === "error") {
      toast({ variant: "error", title: result.message })
      setBoard(previous)
    }

    return false
  }

  const runDelete = async (dealId: string): Promise<void> => {
    const previous = board
    setOpenDealId(null)
    clearDealParam()
    setBoard((prev) =>
      prev.map((column) =>
        recomputeColumn(
          column,
          column.deals.filter((deal) => deal.id !== dealId),
        ),
      ),
    )
    const result = await deleteDealAction(orgSlug, dealId)
    if (result.status === "success") {
      toastWithUndo(result, () => router.refresh())
    } else if (result.status === "error") {
      toast({ variant: "error", title: result.message })
      setBoard(previous)
    }
  }

  const saveNextStep = (dealId: string, nextStep: string) => {
    const trimmed = nextStep.trim()
    const previous = board
    setBoard((prev) => applyNextStep(prev, dealId, trimmed.length > 0 ? trimmed : undefined))
    startTransition(async () => {
      const result = await updateDealNextStepAction(orgSlug, dealId, trimmed)
      if (result.status === "error") {
        toast({ variant: "error", title: result.message })
        setBoard(previous)
      }
    })
  }

  const saveAssignees = (dealId: string, userIds: string[]) => {
    const previous = board
    const nextAssignees = userIds
      .map((id) => members.find((member) => member.userId === id))
      .filter((member): member is OrgMember => member !== undefined)
      .sort((a, b) => a.name.localeCompare(b.name, "cs"))
    setBoard((prev) => applyAssignees(prev, dealId, nextAssignees))
    startTransition(async () => {
      const result = await setDealAssigneesAction(orgSlug, dealId, userIds)
      if (result.status === "error") {
        toast({ variant: "error", title: result.message })
        setBoard(previous)
      }
    })
  }

  const requestMove = (dealId: string, toStage: DealStage) => {
    const source = board.find((column) => column.deals.some((deal) => deal.id === dealId))
    if (source === undefined || source.stage === toStage) {
      return
    }

    if (toStage === lostStage) {
      setOpenDealId(null)
      clearDealParam()
      setLostTargetId(dealId)

      return
    }

    if (toStage === wonStage) {
      setOpenDealId(null)
      clearDealParam()
      setWonTargetId(dealId)

      return
    }

    commitMove(dealId, toStage)
  }

  // Optimistically reorders within a stage (or across stages) at an exact index,
  // then persists the whole destination column via reorderDealAction. Terminal
  // stages never reach here, they route through requestMove and the win/loss dialogs.
  const applyReorder = (dealId: string, toStage: DealStage, targetIndex: number) => {
    const source = board.find((column) => column.deals.some((deal) => deal.id === dealId))
    const dest = board.find((column) => column.stage === toStage)
    const moving = source?.deals.find((deal) => deal.id === dealId)
    if (source === undefined || dest === undefined || moving === undefined) {
      return
    }

    const originalIndex = dest.deals.findIndex((deal) => deal.id === dealId)
    // targetIndex counts the column as shown (the dragged card is still visible),
    // so a same-column down move needs to shift one slot up after removal.
    const insertAt =
      originalIndex !== -1 && originalIndex < targetIndex ? targetIndex - 1 : targetIndex
    const orderedIds = dest.deals.filter((deal) => deal.id !== dealId).map((deal) => deal.id)
    orderedIds.splice(insertAt, 0, dealId)

    const previous = board
    const stageChanged = source.stage !== toStage
    const movedCard: DealCard = stageChanged
      ? { ...moving, stage: toStage, daysInStage: 0, isStale: false }
      : moving
    const rank = new Map(orderedIds.map((id, index) => [id, index]))
    const next = board.map((column) => {
      if (column.stage === source.stage && column.stage !== toStage) {
        return recomputeColumn(
          column,
          column.deals.filter((deal) => deal.id !== dealId),
        )
      }

      if (column.stage === toStage) {
        const ordered = [...column.deals.filter((deal) => deal.id !== dealId), movedCard].sort(
          (a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0),
        )

        return recomputeColumn(column, ordered)
      }

      return column
    })
    setBoard(next)

    startTransition(async () => {
      const result = await reorderDealAction(orgSlug, dealId, toStage, orderedIds)
      if (result.status === "error") {
        toast({ variant: "error", title: result.message })
        setBoard(previous)
      }
    })
  }

  // The monitor registers once, so these refs keep its callbacks reading the current
  // board instead of the closure captured at the registration render.
  const requestMoveRef = useRef(requestMove)
  const applyReorderRef = useRef(applyReorder)
  const isClosedStageRef = useRef(isClosedStage)
  const columnLengthRef = useRef(
    (stage: DealStage) => board.find((column) => column.stage === stage)?.deals.length ?? 0,
  )
  useEffect(() => {
    requestMoveRef.current = requestMove
    applyReorderRef.current = applyReorder
    isClosedStageRef.current = isClosedStage
    columnLengthRef.current = (stage: DealStage) =>
      board.find((column) => column.stage === stage)?.deals.length ?? 0
  })

  useEffect(
    () =>
      monitorForElements({
        canMonitor: ({ source }) => isDealCardData(source.data),
        onDrag: ({ source, location }) => {
          if (!isDealCardData(source.data)) {
            return
          }

          const resolved = resolveDropPosition(
            source.data.dealId,
            location.current.dropTargets,
            columnLengthRef.current,
          )
          const nextHint =
            resolved !== null && !resolved.onSource
              ? { stage: resolved.stage, index: resolved.index }
              : null
          setDropHint((current) =>
            current !== null &&
            nextHint !== null &&
            current.stage === nextHint.stage &&
            current.index === nextHint.index
              ? current
              : nextHint,
          )
        },
        onDrop: ({ source, location }) => {
          setDropHint(null)
          if (!isDealCardData(source.data)) {
            return
          }

          const resolved = resolveDropPosition(
            source.data.dealId,
            location.current.dropTargets,
            columnLengthRef.current,
          )
          if (resolved === null) {
            return
          }

          if (isClosedStageRef.current(resolved.stage)) {
            requestMoveRef.current(source.data.dealId, resolved.stage)

            return
          }

          applyReorderRef.current(source.data.dealId, resolved.stage, resolved.index)
        },
      }),
    [],
  )

  const allDeals = board.flatMap((column) => column.deals)
  const openDeal = allDeals.find((deal) => deal.id === openDealId)
  const wonTarget = allDeals.find((deal) => deal.id === wonTargetId)
  const lostTarget = allDeals.find((deal) => deal.id === lostTargetId)

  const openColumns = board.filter((column) => !isClosedStage(column.stage))
  const closedColumns = board.filter((column) => isClosedStage(column.stage))

  return (
    <>
      <div className="flex items-stretch gap-4 overflow-x-auto pb-2">
        {openColumns.map((column) => (
          <StageColumn
            key={column.stage}
            column={column}
            option={optionByValue.get(column.stage)}
            stageOptions={stageOptions}
            isDropTarget={dragOverStage === column.stage}
            draggingId={draggingId}
            dropHint={dropHint}
            setDragOverStage={setDragOverStage}
            onOpenDeal={(id) => setOpenDealId(id)}
            onMove={requestMove}
            onAdvance={runAdvance}
            onSaveNextStep={saveNextStep}
            setDraggingId={setDraggingId}
          />
        ))}

        {closedColumns.map((column) =>
          expandedClosed.includes(column.stage) ? (
            <StageColumn
              key={column.stage}
              column={column}
              option={optionByValue.get(column.stage)}
              stageOptions={stageOptions}
              isDropTarget={dragOverStage === column.stage}
              draggingId={draggingId}
              dropHint={dropHint}
              setDragOverStage={setDragOverStage}
              onOpenDeal={(id) => setOpenDealId(id)}
              onMove={requestMove}
              onAdvance={runAdvance}
              onSaveNextStep={saveNextStep}
              setDraggingId={setDraggingId}
              onCollapse={() => toggleClosed(column.stage)}
            />
          ) : (
            <ClosedRail
              key={column.stage}
              column={column}
              option={optionByValue.get(column.stage)}
              isDropTarget={dragOverStage === column.stage}
              setDragOverStage={setDragOverStage}
              onExpand={() => toggleClosed(column.stage)}
            />
          ),
        )}
      </div>

      <Dialog
        open={openDeal !== undefined}
        onOpenChange={(open) => {
          if (!open) {
            setOpenDealId(null)
            clearDealParam()
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

interface StageColumnProps {
  column: DealStageColumn
  option: EnumOption | undefined
  stageOptions: EnumOption[]
  isDropTarget: boolean
  draggingId: string | null
  dropHint: DropHint | null
  setDragOverStage: (stage: DealStage | null) => void
  onOpenDeal: (id: string) => void
  onMove: (dealId: string, stage: DealStage) => void
  onAdvance: (dealId: string, stage: DealStage) => void
  onSaveNextStep: (dealId: string, nextStep: string) => void
  setDraggingId: (id: string | null) => void
  onCollapse?: () => void
}

function StageColumn({
  column,
  option,
  stageOptions,
  isDropTarget,
  draggingId,
  dropHint,
  setDragOverStage,
  onOpenDeal,
  onMove,
  onAdvance,
  onSaveNextStep,
  setDraggingId,
  onCollapse,
}: StageColumnProps) {
  const accent = columnAccent(option?.semantic)
  const stageOpen = !isClosedSemantic(option?.semantic)
  const dotClass = option !== undefined ? optionBadgeStyle(option).dot : "bg-border-strong"
  const dropRef = useStageDropTarget(column.stage, setDragOverStage)
  const showEndHint = dropHint?.stage === column.stage && dropHint.index >= column.deals.length

  return (
    <section ref={dropRef} className="flex min-w-[216px] flex-1 flex-col">
      <header
        className={cn(
          "flex items-center gap-2 rounded-t-2xl border border-b-0 border-hairline px-3.5 py-2.5",
          accent.header,
        )}
      >
        <span aria-hidden className={cn("size-2 shrink-0 rounded-full", dotClass)} />
        <span className={cn("text-[13px] font-semibold", accent.label)}>{column.label}</span>
        <span
          className={cn(
            "rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums",
            accent.count,
          )}
        >
          {column.count}
        </span>
        <span className="ml-auto text-[12px] font-medium tabular-nums text-muted">
          {formatCzk(column.sumCzk)}
        </span>
        {onCollapse !== undefined ? (
          <button
            type="button"
            aria-label={`Sbalit ${column.label}`}
            onClick={onCollapse}
            className="-mr-1 flex size-6 shrink-0 items-center justify-center rounded-full text-muted-soft transition-colors hover:bg-surface-3/70 hover:text-foreground"
          >
            <ChevronRight className="size-4" />
          </button>
        ) : null}
      </header>
      <div
        className={cn(
          "flex min-h-[140px] flex-1 flex-col gap-2.5 rounded-b-2xl border border-hairline p-2.5 transition-colors",
          accent.body,
          isDropTarget && "ring-2 ring-inset ring-primary/40",
        )}
      >
        {column.deals.length === 0 && !showEndHint ? (
          <div className="flex flex-1 items-center justify-center py-8 text-center">
            <span className="text-xs text-muted-soft">Žádné dealy</span>
          </div>
        ) : (
          column.deals.map((deal, index) => {
            const showHintBefore = dropHint?.stage === column.stage && dropHint.index === index

            return (
              <div key={deal.id} className="flex flex-col gap-2.5">
                {showHintBefore ? <DropLine /> : null}
                <DealCardView
                  deal={deal}
                  index={index}
                  stageOpen={stageOpen}
                  stageOptions={stageOptions}
                  cardClassName={accent.card}
                  dragging={draggingId === deal.id}
                  onOpen={() => onOpenDeal(deal.id)}
                  setDraggingId={setDraggingId}
                  onMove={(stage) => onMove(deal.id, stage)}
                  onAdvance={(stage) => onAdvance(deal.id, stage)}
                  onSaveNextStep={(nextStep) => onSaveNextStep(deal.id, nextStep)}
                />
              </div>
            )
          })
        )}
        {showEndHint ? <DropLine /> : null}
      </div>
    </section>
  )
}

interface ClosedRailProps {
  column: DealStageColumn
  option: EnumOption | undefined
  isDropTarget: boolean
  setDragOverStage: (stage: DealStage | null) => void
  onExpand: () => void
}

function ClosedRail({ column, option, isDropTarget, setDragOverStage, onExpand }: ClosedRailProps) {
  const accent = columnAccent(option?.semantic)
  const dotClass = option !== undefined ? optionBadgeStyle(option).dot : "bg-border-strong"
  const dropRef = useStageDropTarget(column.stage, setDragOverStage)

  return (
    <section ref={dropRef} className="flex shrink-0">
      <button
        type="button"
        onClick={onExpand}
        aria-label={`Rozbalit ${column.label} (${column.count})`}
        className={cn(
          "flex h-full w-14 flex-col items-center gap-3 rounded-2xl border border-hairline py-3 transition-colors",
          accent.body,
          isDropTarget && "ring-2 ring-inset ring-primary/40",
        )}
      >
        <ChevronLeft className={cn("size-4 shrink-0", accent.label)} />
        <span aria-hidden className={cn("size-2 shrink-0 rounded-full", dotClass)} />
        <span
          className={cn(
            "flex-1 text-[13px] font-semibold [writing-mode:vertical-rl] rotate-180",
            accent.label,
          )}
        >
          {column.label}
        </span>
        <span
          className={cn(
            "rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums",
            accent.count,
          )}
        >
          {column.count}
        </span>
        <span className="text-[10px] font-medium tabular-nums text-muted-soft">
          {formatCzkCompact(column.sumCzk)}
        </span>
      </button>
    </section>
  )
}

interface CloseChip {
  label: string
  className: string
}

const closeChip = (deal: DealCard): CloseChip | null => {
  if (deal.expectedClose === undefined || deal.closeDaysUntil === undefined) {
    return null
  }

  const date = formatShortDate(deal.expectedClose)
  if (deal.closeDaysUntil < 0) {
    return { label: `${date} po termínu`, className: "bg-red-soft text-red-text" }
  }

  if (deal.closeDaysUntil <= 7) {
    return { label: date, className: "bg-orange-soft text-orange-text" }
  }

  return { label: date, className: "bg-surface-3/60 text-muted" }
}

interface DealCardViewProps {
  deal: DealCard
  index: number
  stageOpen: boolean
  stageOptions: EnumOption[]
  cardClassName: string
  dragging: boolean
  onOpen: () => void
  setDraggingId: (id: string | null) => void
  onMove: (stage: DealStage) => void
  onAdvance: (stage: DealStage) => void
  onSaveNextStep: (nextStep: string) => void
}

function DealCardView({
  deal,
  index,
  stageOpen,
  stageOptions,
  cardClassName,
  dragging,
  onOpen,
  setDraggingId,
  onMove,
  onAdvance,
  onSaveNextStep,
}: DealCardViewProps) {
  const { orgSlug } = useOrg()
  const [menuOpen, setMenuOpen] = useState(false)
  const [nextStepOpen, setNextStepOpen] = useState(false)
  const stale = stageOpen && deal.isStale
  const chip = stageOpen ? closeChip(deal) : null
  const wonStage = stageOptions.find((option) => option.semantic === "won")?.value
  const lostStage = stageOptions.find((option) => option.semantic === "lost")?.value
  const openStageValues = stageOptions
    .filter((option) => !isClosedSemantic(option.semantic))
    .map((option) => option.value)
  const currentOpenIndex = openStageValues.indexOf(deal.stage)
  const nextStage = currentOpenIndex !== -1 ? openStageValues[currentOpenIndex + 1] : undefined
  const dragRef = useDealCardDraggable(
    deal.id,
    deal.stage,
    index,
    !menuOpen && !nextStepOpen,
    setDraggingId,
  )

  return (
    <div
      ref={dragRef}
      onClick={onOpen}
      className={cn(
        "group relative cursor-pointer rounded-xl border border-hairline p-3 shadow-soft transition-shadow hover:shadow-lifted",
        cardClassName,
        stale && "border-l-[3px] border-l-orange",
        dragging && "opacity-40",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <Link
          href={orgHref(orgSlug, `/klienti/${deal.clientId}`)}
          draggable={false}
          onClick={(event) => event.stopPropagation()}
          className="text-[13px] font-semibold leading-tight text-foreground transition-colors hover:text-primary"
        >
          {deal.clientName}
        </Link>
        <div className="-mr-1 -mt-1 flex shrink-0 items-center">
          {deal.offerUrl !== undefined ? (
            <a
              href={deal.offerUrl}
              target="_blank"
              rel="noreferrer"
              draggable={false}
              aria-label="Odkaz na nabídku"
              title="Odkaz na nabídku"
              onClick={(event) => event.stopPropagation()}
              className="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-soft transition-colors hover:bg-surface-3/70 hover:text-foreground"
            >
              <ExternalLink className="size-3.5" />
            </a>
          ) : null}
          <Popover open={menuOpen} onOpenChange={setMenuOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label="Přesunout deal"
                onClick={(event) => event.stopPropagation()}
                className="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-soft transition-colors hover:bg-surface-3/70 hover:text-foreground"
              >
                <MoreHorizontal className="size-4" />
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              className="w-52 p-1.5"
              onClick={(event) => event.stopPropagation()}
            >
              <StageMoveList
                current={deal.stage}
                stageOptions={stageOptions}
                onSelect={(stage) => {
                  setMenuOpen(false)
                  onMove(stage)
                }}
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation()
          onOpen()
        }}
        className="mt-1 block text-left text-[12px] leading-snug text-muted transition-colors hover:text-foreground"
      >
        {deal.title}
      </button>

      <div className="mt-2.5 flex items-baseline justify-between gap-2">
        <span className="text-[15px] font-semibold tabular-nums tracking-tight text-foreground">
          {formatCzk(deal.valueCzk)}
        </span>
        {deal.probability !== undefined ? (
          <span className="text-[12px] tabular-nums text-muted-soft">
            {formatPercent(deal.probability)}
          </span>
        ) : null}
      </div>

      {stageOpen ? (
        <NextStepEditor
          deal={deal}
          open={nextStepOpen}
          onOpenChange={setNextStepOpen}
          onSave={onSaveNextStep}
        />
      ) : deal.lostReason !== undefined ? (
        <p className="mt-2 truncate text-[12px] text-muted-soft" title={deal.lostReason}>
          {deal.lostReason}
        </p>
      ) : null}

      {stageOpen ? (
        <div className="mt-2.5 flex items-center justify-between gap-2">
          <span
            className={cn(
              "text-[11px] tabular-nums",
              stale ? "font-semibold text-orange-text" : "text-muted-soft",
            )}
          >
            {stale ? `${deal.daysInStage} dní bez pohybu` : formatDaysInStage(deal.daysInStage)}
          </span>
          {chip !== null ? (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] font-medium tabular-nums",
                chip.className,
              )}
            >
              <CalendarClock className="size-3" />
              {chip.label}
            </span>
          ) : null}
        </div>
      ) : deal.expectedClose !== undefined ? (
        <p className="mt-2.5 text-[11px] tabular-nums text-muted-soft">
          Uzavřeno {formatCzechDate(deal.expectedClose)}
        </p>
      ) : null}

      {deal.assignees.length > 0 ? (
        <div className="mt-2.5 flex justify-end">
          <AvatarStack members={deal.assignees} />
        </div>
      ) : null}

      {stageOpen ? (
        <div className="absolute bottom-2 right-2 z-10 hidden items-center gap-0.5 rounded-full border border-hairline bg-surface p-0.5 shadow-lifted group-hover:flex">
          {wonStage !== undefined ? (
            <button
              type="button"
              aria-label="Vyhrát"
              title="Vyhrát"
              onClick={(event) => {
                event.stopPropagation()
                onMove(wonStage)
              }}
              className="flex size-6 cursor-pointer items-center justify-center rounded-full text-muted-soft transition-colors hover:bg-green-soft/70 hover:text-green-text"
            >
              <Trophy className="size-3.5" />
            </button>
          ) : null}
          {lostStage !== undefined ? (
            <button
              type="button"
              aria-label="Prohrát"
              title="Prohrát"
              onClick={(event) => {
                event.stopPropagation()
                onMove(lostStage)
              }}
              className="flex size-6 cursor-pointer items-center justify-center rounded-full text-muted-soft transition-colors hover:bg-red-soft/70 hover:text-red-text"
            >
              <ThumbsDown className="size-3.5" />
            </button>
          ) : null}
          {nextStage !== undefined ? (
            <button
              type="button"
              aria-label="Posunout dál"
              title="Posunout dál"
              onClick={(event) => {
                event.stopPropagation()
                onAdvance(nextStage)
              }}
              className="flex size-6 cursor-pointer items-center justify-center rounded-full text-muted-soft transition-colors hover:bg-surface-3/70 hover:text-foreground"
            >
              <ArrowRight className="size-3.5" />
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

interface NextStepEditorProps {
  deal: DealCard
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (nextStep: string) => void
}

function NextStepEditor({ deal, open, onOpenChange, onSave }: NextStepEditorProps) {
  const [value, setValue] = useState(deal.nextStep ?? "")

  useEffect(() => {
    if (open) {
      setValue(deal.nextStep ?? "")
    }
  }, [open, deal.nextStep])

  // The save is optimistic (the card text updates immediately), so the popover
  // closes right away; a failure reverts the card and shows an error toast.
  const submit = () => {
    onSave(value)
    onOpenChange(false)
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Upravit další krok"
          onClick={(event) => event.stopPropagation()}
          className={cn(
            "mt-2 -mx-1.5 flex w-[calc(100%+0.75rem)] items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-[12px] transition-colors hover:bg-surface-3/50",
            deal.nextStep !== undefined ? "text-muted" : "text-muted-soft",
          )}
        >
          {deal.nextStep !== undefined ? (
            <span className="truncate">{deal.nextStep}</span>
          ) : (
            <>
              <Plus className="size-3.5 shrink-0" />
              <span>Přidat další krok</span>
            </>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-72 p-2.5"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
            event.preventDefault()
            submit()
          }
        }}
      >
        <span className="mb-1.5 block px-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted-soft">
          Další krok
        </span>
        <Textarea
          autoFocus
          rows={3}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="Poslat finální smlouvu"
          className="rounded-lg px-3 py-2 text-[13px]"
        />
        <div className="mt-2 flex items-center justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Zrušit
          </Button>
          <Button type="button" size="sm" onClick={submit}>
            Uložit
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
