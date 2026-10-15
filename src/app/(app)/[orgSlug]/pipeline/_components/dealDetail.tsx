"use client"

import {
  useCallback,
  useEffect,
  useState,
  useTransition,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import {
  Check,
  ChevronDown,
  ExternalLink,
  FolderPlus,
  MoreHorizontal,
  Trash2,
  UserPlus,
} from "lucide-react"
import { badgeStyleFor, optionBadgeStyle, styleMap } from "@/lib/crm/config"
import { Button } from "@/app/_ui/Button"
import { ConfirmDialog } from "@/app/_ui/ConfirmDialog"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/app/_ui/Dialog"
import { Field } from "@/app/_ui/Field"
import { Popover, PopoverContent, PopoverTrigger } from "@/app/_ui/Popover"
import { Spinner } from "@/app/_ui/Spinner"
import { AvatarStack } from "@/app/_components/AvatarStack"
import { AssigneePicker } from "@/app/_components/AssigneePicker"
import { TaskSubtasks } from "@/app/_components/task-detail/TaskSubtasks"
import { useTaskDetail } from "@/app/_components/task-detail/TaskDetailProvider"
import { deleteTaskAction, toggleSubtaskAction } from "@/app/_components/task-detail/actions"
import type { TaskSubtask } from "@/app/_components/task-detail/types"
import { ToastVariant, useToast } from "@/app/_ui/Toast"
import { useUndoToast } from "@/app/_lib/useUndoToast"
import { orgHref } from "@/lib/nav"
import { DescriptionEditor } from "@/app/_ui/DescriptionEditor"
import { useOrg } from "@/app/_components/org/OrgProvider"
import { cn } from "@/lib/cn"
import { formatCzechDate } from "@/lib/dates"
import type { DealStage, EnumOption, OrgMember } from "@/core/types/crm.types"
import type { DealCard } from "@/lib/crm/store/deals"
import { formatCzk, formatDaysInStage, formatPercent } from "../_lib/format"
import { HistorySection } from "@/app/_components/HistorySection"
import {
  addDealTicketAction,
  listDealHistoryAction,
  listDealTicketsAction,
  quickEditDealAction,
  updateDealDescriptionAction,
  updateDealNextStepAction,
  updateDealTitleAction,
} from "../actions"
import type { DealQuickEditPatch } from "../_lib/types"
import { DatePicker } from "@/app/_ui/DatePicker"

export const buildProjectUrl = (deal: DealCard): string => {
  const params = new URLSearchParams({
    clientId: deal.clientId,
    dealId: deal.id,
    name: deal.title,
    budget: String(deal.valueCzk),
  })

  return `/projekty/novy?${params.toString()}`
}

interface StageMoveListProps {
  current: DealStage
  stageOptions: EnumOption[]
  onSelect: (stage: DealStage) => void
}

export function StageMoveList({ current, stageOptions, onSelect }: StageMoveListProps) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-soft">
        Přesunout do fáze
      </span>
      {stageOptions.map((option) => {
        const active = option.value === current
        const style = optionBadgeStyle(option)

        return (
          <button
            key={option.value}
            type="button"
            disabled={active}
            onClick={() => onSelect(option.value)}
            className={cn(
              "flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[13px] transition-colors",
              active ? "cursor-default text-muted-soft" : "cursor-pointer text-foreground hover:bg-surface-2",
            )}
          >
            <span aria-hidden className={cn("size-[7px] shrink-0 rounded-full", style.dot)} />
            <span className="flex-1 truncate">{style.label}</span>
            {active ? <Check className="size-3.5 shrink-0 text-muted-soft" /> : null}
          </button>
        )
      })}
    </div>
  )
}

interface DealDetailProps {
  deal: DealCard
  stageOptions: EnumOption[]
  members: OrgMember[]
  onMove: (stage: DealStage) => void
  onDelete: () => Promise<void>
  onAssigneesChange: (userIds: string[]) => void
}

export function DealDetail({
  deal,
  stageOptions,
  members,
  onMove,
  onDelete,
  onAssigneesChange,
}: DealDetailProps) {
  const { orgSlug } = useOrg()
  const { openTask } = useTaskDetail()
  const { toast } = useToast()
  const { toastWithUndo } = useUndoToast()
  const [menuOpen, setMenuOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [tickets, setTickets] = useState<TaskSubtask[] | null>(null)
  const [, startSave] = useTransition()
  const today = format(new Date(), "yyyy-MM-dd")

  const reloadTickets = useCallback(async () => {
    const rows = await listDealTicketsAction(orgSlug, deal.id)
    setTickets(rows)
  }, [orgSlug, deal.id])

  useEffect(() => {
    setTickets(null)
    void reloadTickets()
  }, [reloadTickets])

  const saveTitle = (title: string) => {
    startSave(async () => {
      const result = await updateDealTitleAction(orgSlug, deal.id, title)
      if (result.status === "error") {
        toast({ variant: ToastVariant.Error, title: result.message })
      }
    })
  }

  const saveDescription = (description: string) => {
    startSave(async () => {
      const result = await updateDealDescriptionAction(orgSlug, deal.id, description)
      if (result.status === "error") {
        toast({ variant: ToastVariant.Error, title: result.message })
      }
    })
  }

  const savePatch = (patch: DealQuickEditPatch) => {
    startSave(async () => {
      const result = await quickEditDealAction(orgSlug, deal.id, patch)
      if (result.status === "error") {
        toast({ variant: ToastVariant.Error, title: result.message })
      }
    })
  }

  const saveNextStep = (nextStep: string) => {
    startSave(async () => {
      const result = await updateDealNextStepAction(orgSlug, deal.id, nextStep)
      if (result.status === "error") {
        toast({ variant: ToastVariant.Error, title: result.message })
      }
    })
  }

  const toggleTicket = (ticketId: string) => {
    if (tickets === null) {
      return
    }

    const previous = tickets
    setTickets(tickets.map((t) => (t.id === ticketId ? { ...t, done: !t.done } : t)))
    startSave(async () => {
      const result = await toggleSubtaskAction(orgSlug, { subtaskId: ticketId })
      if (result.status === "error") {
        setTickets(previous)
        toast({ variant: ToastVariant.Error, title: result.message })
      }
    })
  }

  const addTicket = (title: string) => {
    if (tickets === null) {
      return
    }

    const tempId = `temp_${Date.now()}`
    setTickets([
      ...tickets,
      { id: tempId, title, done: false, dueAt: null, assignees: [], pending: true },
    ])
    startSave(async () => {
      const result = await addDealTicketAction(orgSlug, deal.id, title)
      if (result.status === "error") {
        setTickets((current) =>
          current === null ? current : current.filter((t) => t.id !== tempId),
        )
        toast({ variant: ToastVariant.Error, title: result.message })

        return
      }

      await reloadTickets()
    })
  }

  const deleteTicket = (ticketId: string) => {
    if (tickets === null) {
      return
    }

    const previous = tickets
    setTickets(tickets.filter((t) => t.id !== ticketId))
    startSave(async () => {
      const result = await deleteTaskAction(orgSlug, { ticketId })
      if (result.status === "error") {
        setTickets(previous)
        toast({ variant: ToastVariant.Error, title: result.message })
      } else if (result.status === "success") {
        toastWithUndo(result, () => void reloadTickets())
      }
    })
  }

  const selectedAssignees = deal.assignees.map((member) => member.userId)
  const toggleAssignee = (userId: string) => {
    onAssigneesChange(
      selectedAssignees.includes(userId)
        ? selectedAssignees.filter((id) => id !== userId)
        : [...selectedAssignees, userId],
    )
  }

  return (
    <>
      <DialogTitle className="sr-only">Detail dealu</DialogTitle>

      <div className="flex items-center justify-between gap-3 pr-8">
        <nav className="flex min-w-0 items-center gap-1 text-xs text-muted">
          <Link
            href={orgHref(orgSlug, `/klienti/${deal.clientId}`)}
            className="truncate transition-colors hover:text-foreground"
          >
            {deal.clientName}
          </Link>
        </nav>
        <div className="flex shrink-0 items-center gap-1">
          <Popover open={menuOpen} onOpenChange={setMenuOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label="Další akce"
                className="flex size-8 cursor-pointer items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
              >
                <MoreHorizontal className="size-4" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-auto p-1">
              <div className="flex min-w-52 flex-col gap-0.5">
                <StageMoveList
                  current={deal.stage}
                  stageOptions={stageOptions}
                  onSelect={(stage) => {
                    setMenuOpen(false)
                    onMove(stage)
                  }}
                />
                <div className="my-1 h-px bg-border" />
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false)
                    setConfirmOpen(true)
                  }}
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm text-danger transition-colors hover:bg-danger-soft"
                >
                  <Trash2 className="size-3.5 shrink-0" />
                  Smazat deal
                </button>
              </div>
            </PopoverContent>
          </Popover>
          <ConfirmDialog
            open={confirmOpen}
            onOpenChange={setConfirmOpen}
            title="Smazat deal"
            description={`Deal "${deal.title}" bude nenávratně smazán. Aktivity dealu zůstanou v historii klienta.`}
            confirmLabel="Smazat deal"
            destructive
            onConfirm={onDelete}
          />
        </div>
      </div>

      <DealTitleInput key={deal.id} value={deal.title} onCommit={saveTitle} />

      <div className="grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2">
        <PropertyRow label="Fáze">
          <StageControl
            current={deal.stage}
            stageOptions={stageOptions}
            daysInStage={deal.daysInStage}
            onSelect={onMove}
          />
        </PropertyRow>

        <PropertyRow label="Řeší">
          <AssigneePicker
            members={members}
            selected={selectedAssignees}
            onToggle={toggleAssignee}
            onClear={() => onAssigneesChange([])}
            trigger={
              <button
                type="button"
                className="inline-flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
              >
                {deal.assignees.length > 0 ? (
                  <>
                    <AvatarStack members={deal.assignees} />
                    <span className="truncate text-[13px] text-muted">
                      {deal.assignees.map((member) => member.name).join(", ")}
                    </span>
                  </>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-[13px] text-muted-soft">
                    <UserPlus className="size-3.5" />
                    Přiřadit
                  </span>
                )}
              </button>
            }
          />
        </PropertyRow>

        <PropertyRow label="Hodnota">
          <InlineNumberControl
            key={`value-${deal.id}-${deal.valueCzk}`}
            value={deal.valueCzk}
            display={formatCzk(deal.valueCzk)}
            suffix="Kč"
            allowEmpty={false}
            onCommit={(valueCzk) => {
              if (valueCzk !== null) {
                savePatch({ valueCzk })
              }
            }}
          />
        </PropertyRow>

        <PropertyRow label="Pravděpodobnost">
          <InlineNumberControl
            key={`prob-${deal.id}-${deal.probability ?? "none"}`}
            value={deal.probability ?? null}
            display={deal.probability !== undefined ? formatPercent(deal.probability) : null}
            suffix="%"
            max={100}
            allowEmpty
            onCommit={(probability) => savePatch({ probability })}
          />
        </PropertyRow>

        <PropertyRow label="Uzavření">
          <InlineDateControl
            value={deal.expectedClose ?? null}
            onCommit={(expectedClose) => savePatch({ expectedClose })}
          />
        </PropertyRow>

        <PropertyRow label="Vytvořeno">
          <span className="block px-2 py-1.5 text-[13px] tabular-nums text-muted">
            {formatCzechDate(deal.createdAt)}
          </span>
        </PropertyRow>

        <PropertyRow label="Další krok" className="sm:col-span-2">
          <InlineTextControl
            key={`next-${deal.id}-${deal.nextStep ?? ""}`}
            value={deal.nextStep ?? ""}
            placeholder="Přidat další krok"
            onCommit={saveNextStep}
          />
        </PropertyRow>

        {deal.lostReason !== undefined ? (
          <PropertyRow label="Důvod prohry" className="sm:col-span-2">
            <span className="block px-2 py-1.5 text-[13px] text-foreground">{deal.lostReason}</span>
          </PropertyRow>
        ) : null}

        <PropertyRow label="Nabídka" className="sm:col-span-2">
          <div className="flex min-w-0 items-center gap-1">
            <div className="min-w-0 flex-1">
              <InlineTextControl
                key={`offer-${deal.id}-${deal.offerUrl ?? ""}`}
                value={deal.offerUrl ?? ""}
                placeholder="Přidat odkaz na nabídku"
                onCommit={(offerUrl) => savePatch({ offerUrl: offerUrl.length > 0 ? offerUrl : null })}
              />
            </div>
            {deal.offerUrl !== undefined ? (
              <a
                href={deal.offerUrl}
                target="_blank"
                rel="noreferrer"
                aria-label="Otevřít nabídku"
                title="Otevřít nabídku"
                className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-lg text-muted-soft transition-colors hover:bg-surface-2 hover:text-foreground"
              >
                <ExternalLink className="size-3.5" />
              </a>
            ) : null}
          </div>
        </PropertyRow>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-muted">Popis</span>
        <DescriptionEditor
          value={deal.description ?? ""}
          onCommit={saveDescription}
          placeholder="Přidat popis dealu"
        />
      </div>

      <div className="h-px bg-border" />

      {tickets === null ? (
        <div className="flex items-center justify-center py-4">
          <Spinner className="size-4 text-muted-soft" />
        </div>
      ) : (
        <TaskSubtasks
          heading="Úkoly"
          addPlaceholder="Přidat úkol"
          subtasks={tickets}
          today={today}
          onOpen={openTask}
          onToggle={toggleTicket}
          onAdd={addTicket}
          onDelete={deleteTicket}
        />
      )}

      <div className="h-px bg-border" />

      <HistorySection key={deal.id} load={() => listDealHistoryAction(orgSlug, deal.id)} />
    </>
  )
}

function DealTitleInput({ value, onCommit }: { value: string; onCommit: (value: string) => void }) {
  const [local, setLocal] = useState(value)

  useEffect(() => {
    setLocal(value)
  }, [value])

  const commit = () => {
    const trimmed = local.trim()
    if (trimmed.length === 0) {
      setLocal(value)

      return
    }

    if (trimmed !== value) {
      onCommit(trimmed)
    }
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault()
      event.currentTarget.blur()
    }
  }

  return (
    <input
      value={local}
      onChange={(event) => setLocal(event.target.value)}
      onBlur={commit}
      onKeyDown={handleKeyDown}
      placeholder="Název dealu"
      autoComplete="off"
      className="w-full bg-transparent font-display text-2xl font-semibold tracking-tight text-foreground outline-none placeholder:text-muted-soft"
    />
  )
}

function StageControl({
  current,
  stageOptions,
  daysInStage,
  onSelect,
}: {
  current: DealStage
  stageOptions: EnumOption[]
  daysInStage: number
  onSelect: (stage: DealStage) => void
}) {
  const [open, setOpen] = useState(false)
  const activeStyle = badgeStyleFor(current, styleMap(stageOptions))

  return (
    <div className="flex min-w-0 items-center gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1 transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          >
            <span
              className={cn(
                "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium",
                activeStyle.badge,
              )}
            >
              <span aria-hidden className={cn("size-1.5 shrink-0 rounded-full", activeStyle.dot)} />
              {activeStyle.label}
            </span>
            <ChevronDown className="size-3.5 text-muted-soft" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-1">
          <StageMoveList
            current={current}
            stageOptions={stageOptions}
            onSelect={(stage) => {
              setOpen(false)
              onSelect(stage)
            }}
          />
        </PopoverContent>
      </Popover>
      <span className="shrink-0 text-xs tabular-nums text-muted-soft">
        {formatDaysInStage(daysInStage)}
      </span>
    </div>
  )
}

const inlineDisplayClass =
  "block w-full cursor-pointer truncate rounded-lg px-2 py-1.5 text-left text-[13px] transition-colors hover:bg-surface-2"
const inlineInputClass =
  "w-full rounded-lg border border-primary/40 bg-surface px-2 py-1 text-[13px] text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary/20"

// Click-to-edit single-line text. Blur or Enter commits, Escape reverts. An empty
// commit is passed through so the caller can clear the field.
function InlineTextControl({
  value,
  placeholder,
  onCommit,
}: {
  value: string
  placeholder: string
  onCommit: (value: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [local, setLocal] = useState(value)

  const commit = () => {
    setEditing(false)
    const trimmed = local.trim()
    if (trimmed !== value.trim()) {
      onCommit(trimmed)
    }
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setLocal(value)
          setEditing(true)
        }}
        className={cn(inlineDisplayClass, value.length > 0 ? "text-foreground" : "text-muted-soft")}
      >
        {value.length > 0 ? value : placeholder}
      </button>
    )
  }

  return (
    <input
      autoFocus
      value={local}
      placeholder={placeholder}
      onChange={(event) => setLocal(event.target.value)}
      onBlur={commit}
      onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === "Enter") {
          event.preventDefault()
          event.currentTarget.blur()
        }

        if (event.key === "Escape") {
          setLocal(value)
          setEditing(false)
        }
      }}
      className={inlineInputClass}
    />
  )
}

// Click-to-edit number (Kč, %). Empty input commits null when allowEmpty, otherwise
// reverts. Non-numeric input reverts silently; range errors surface from the action.
function InlineNumberControl({
  value,
  display,
  suffix,
  max,
  allowEmpty,
  onCommit,
}: {
  value: number | null
  display: string | null
  suffix: string
  max?: number
  allowEmpty: boolean
  onCommit: (value: number | null) => void
}) {
  const [editing, setEditing] = useState(false)
  const [local, setLocal] = useState(value !== null ? String(value) : "")

  const commit = () => {
    setEditing(false)
    const trimmed = local.trim().replace(/\s+/g, "")
    if (trimmed.length === 0) {
      if (allowEmpty && value !== null) {
        onCommit(null)
      }

      return
    }

    const parsed = Number(trimmed)
    if (!Number.isFinite(parsed) || parsed < 0 || (max !== undefined && parsed > max)) {
      return
    }

    if (parsed !== value) {
      onCommit(parsed)
    }
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setLocal(value !== null ? String(value) : "")
          setEditing(true)
        }}
        className={cn(
          inlineDisplayClass,
          "tabular-nums",
          display !== null ? "font-medium text-foreground" : "text-muted-soft",
        )}
      >
        {display ?? "Nevyplněno"}
      </button>
    )
  }

  return (
    <div className="flex items-center gap-1.5">
      <input
        autoFocus
        inputMode="numeric"
        value={local}
        onChange={(event) => setLocal(event.target.value)}
        onBlur={commit}
        onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
          if (event.key === "Enter") {
            event.preventDefault()
            event.currentTarget.blur()
          }

          if (event.key === "Escape") {
            setLocal(value !== null ? String(value) : "")
            setEditing(false)
          }
        }}
        className={cn(inlineInputClass, "tabular-nums")}
      />
      <span className="shrink-0 text-[13px] text-muted-soft">{suffix}</span>
    </div>
  )
}

// Click-to-edit date in a popover, mirroring the úkoly due-date quick edit.
function InlineDateControl({
  value,
  onCommit,
}: {
  value: string | null
  onCommit: (value: string | null) => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            inlineDisplayClass,
            "tabular-nums",
            value !== null ? "text-foreground" : "text-muted-soft",
          )}
        >
          {value !== null ? formatCzechDate(value) : "Nevyplněno"}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-2">
        <div className="flex flex-col gap-2">
          <DatePicker
            value={value}
            onChange={(iso) => {
              setOpen(false)
              onCommit(iso)
            }}
            placeholder="Vybrat datum"
          />
          {value !== null ? (
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                onCommit(null)
              }}
              className="cursor-pointer rounded-lg px-2 py-1 text-left text-[13px] text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
            >
              Vymazat datum
            </button>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  )
}

function PropertyRow({
  label,
  className,
  children,
}: {
  label: string
  className?: string
  children: ReactNode
}) {
  return (
    <div className={cn("grid grid-cols-[110px_1fr] items-center gap-2", className)}>
      <span className="text-[13px] text-muted-soft">{label}</span>
      <div className="min-w-0">{children}</div>
    </div>
  )
}

interface WonDialogProps {
  deal: DealCard | undefined
  open: boolean
  onOpenChange: (open: boolean) => void
  onWin: (dealId: string) => Promise<boolean>
}

export function WonDialog({ deal, open, onOpenChange, onWin }: WonDialogProps) {
  const router = useRouter()
  const { orgSlug } = useOrg()
  const [pending, setPending] = useState(false)

  const markWon = async () => {
    if (deal === undefined) {
      return
    }

    setPending(true)
    const ok = await onWin(deal.id)
    setPending(false)
    if (ok) {
      onOpenChange(false)
    }
  }

  const foundProject = async () => {
    if (deal === undefined) {
      return
    }

    setPending(true)
    const ok = await onWin(deal.id)
    setPending(false)
    if (ok) {
      router.push(orgHref(orgSlug, buildProjectUrl(deal)))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        {deal !== undefined ? (
          <>
            <DialogHeader>
              <DialogTitle>Označit deal jako vyhraný</DialogTitle>
              <p className="text-sm text-muted">
                {deal.clientName} · {formatCzk(deal.valueCzk)}
              </p>
            </DialogHeader>
            <div className="rounded-xl border border-hairline bg-surface-2/50 p-4 text-[13px] leading-relaxed text-muted">
              Rovnou založ navazující projekt. Klient, název i rozpočet se předvyplní z tohoto dealu.
              Deal se přesune do Vyhráno.
            </div>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => void foundProject()} disabled={pending}>
                <FolderPlus className="size-4" />
                Založit projekt z dealu
              </Button>
              <Button size="sm" onClick={() => void markWon()} disabled={pending}>
                {pending ? <Spinner className="size-4" /> : null}
                Označit jako vyhráno
              </Button>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

const lostTextareaClasses = cn(
  "flex min-h-24 w-full rounded-xl border border-border-strong/60 bg-surface px-4 py-3 text-[15px] text-foreground",
  "transition-[border-color,box-shadow] duration-150 placeholder:text-muted-soft hover:border-border-strong",
  "focus-visible:border-primary focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/20",
)

interface LostDialogProps {
  deal: DealCard | undefined
  open: boolean
  onOpenChange: (open: boolean) => void
  onLost: (dealId: string, reason: string) => Promise<boolean>
}

export function LostDialog({ deal, open, onOpenChange, onLost }: LostDialogProps) {
  const [reason, setReason] = useState("")
  const [error, setError] = useState<string | undefined>(undefined)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    if (open) {
      setReason("")
      setError(undefined)
    }
  }, [open, deal?.id])

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (deal === undefined) {
      return
    }

    if (reason.trim().length === 0) {
      setError("Uveďte důvod prohry.")

      return
    }

    setError(undefined)
    setPending(true)
    const ok = await onLost(deal.id, reason.trim())
    setPending(false)
    if (ok) {
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        {deal !== undefined ? (
          <>
            <DialogHeader>
              <DialogTitle>Označit deal jako prohraný</DialogTitle>
              <p className="text-sm text-muted">
                {deal.clientName} · {formatCzk(deal.valueCzk)}
              </p>
            </DialogHeader>
            <form onSubmit={(event) => void handleSubmit(event)} className="flex flex-col gap-4">
              <Field label="Důvod prohry" htmlFor="lost-reason" required error={error}>
                <textarea
                  id="lost-reason"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  rows={3}
                  autoFocus
                  placeholder="Klient si vybral konkurenci, rozpočet odložen, ..."
                  className={lostTextareaClasses}
                  aria-invalid={error !== undefined}
                />
              </Field>
              <DialogFooter>
                <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
                  Zrušit
                </Button>
                <Button type="submit" variant="danger" size="sm" disabled={pending}>
                  {pending ? <Spinner className="size-4" /> : null}
                  Označit jako prohráno
                </Button>
              </DialogFooter>
            </form>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
