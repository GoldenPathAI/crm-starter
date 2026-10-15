"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import {
  Archive,
  ArchiveRestore,
  ChevronDown,
  GripVertical,
  Lock,
  Plus,
} from "lucide-react"
import { combine } from "@atlaskit/pragmatic-drag-and-drop/combine"
import {
  draggable,
  dropTargetForElements,
  monitorForElements,
} from "@atlaskit/pragmatic-drag-and-drop/element/adapter"
import {
  attachClosestEdge,
  extractClosestEdge,
  type Edge,
} from "@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge"
import type { ColorToken, EnumKind, EnumOption } from "@/core/types/crm.types"
import { REQUIRED_SEMANTICS } from "@/core/enumDefaults"
import { optionBadgeStyle } from "@/lib/crm/config"
import { cn } from "@/lib/cn"
import { Button } from "@/app/_ui/Button"
import { Input } from "@/app/_ui/Input"
import { Popover, PopoverContent, PopoverTrigger } from "@/app/_ui/Popover"
import { Spinner } from "@/app/_ui/Spinner"
import { useToast } from "@/app/_ui/Toast"
import {
  archiveEnumOptionAction,
  createEnumOptionAction,
  reorderEnumOptionsAction,
  unarchiveEnumOptionAction,
  updateEnumOptionAction,
} from "./actions"

const COLOR_TOKENS: ReadonlyArray<ColorToken> = [
  "slate",
  "blue",
  "green",
  "orange",
  "red",
  "purple",
  "teal",
  "indigo",
  "cyan",
]

const VALUE_PATTERN = /^[a-z][a-z0-9_]*$/

function slugifyValue(label: string): string {
  return label
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
}

interface DealGroupBadge {
  label: string
  className: string
}

function dealGroupBadge(semantic: string | undefined): DealGroupBadge {
  if (semantic === "parked") {
    return { label: "Zaparkováno", className: "bg-surface-3/60 text-muted" }
  }

  if (semantic === "won") {
    return { label: "Vyhráno", className: "bg-green-soft text-green-text" }
  }

  if (semantic === "lost") {
    return { label: "Prohráno", className: "bg-red-soft text-red-text" }
  }

  return { label: "Otevřené", className: "bg-blue-soft text-blue-text" }
}

function isRequired(kind: EnumKind, semantic: string | undefined): boolean {
  const required = REQUIRED_SEMANTICS[kind]

  return semantic !== undefined && required !== undefined && required.includes(semantic)
}

const rowKey = Symbol("enumOptionRow")

type RowDragData = {
  [rowKey]: true
  kind: EnumKind
  id: string
}

const rowDragData = (kind: EnumKind, id: string): RowDragData => ({ [rowKey]: true, kind, id })

const isRowDragData = (data: Record<string | symbol, unknown>): data is RowDragData =>
  data[rowKey] === true

function reorderIds(ids: string[], sourceId: string, targetId: string, edge: Edge | null): string[] {
  const fromIndex = ids.indexOf(sourceId)
  const targetIndex = ids.indexOf(targetId)
  if (fromIndex === -1 || targetIndex === -1) {
    return ids
  }

  const insertAt = targetIndex + (edge === "bottom" ? 1 : 0)
  const without = ids.filter((id) => id !== sourceId)
  const adjusted = fromIndex < insertAt ? insertAt - 1 : insertAt
  without.splice(adjusted, 0, sourceId)

  return without
}

export function EnumEditor({
  orgSlug,
  kind,
  title,
  options,
  canEdit,
}: {
  orgSlug: string
  kind: EnumKind
  title: string
  options: EnumOption[]
  canEdit: boolean
}) {
  const { toast } = useToast()
  const [rows, setRows] = useState<EnumOption[]>(options)
  const [, startTransition] = useTransition()
  const [archivedOpen, setArchivedOpen] = useState(false)

  useEffect(() => {
    setRows(options)
  }, [options])

  const active = rows.filter((row) => row.archivedAt === undefined)
  const archived = rows.filter((row) => row.archivedAt !== undefined)
  const isDealStage = kind === "deal_stage"

  const runReorder = (sourceId: string, targetId: string, edge: Edge | null) => {
    const currentIds = active.map((row) => row.id)
    const orderedIds = reorderIds(currentIds, sourceId, targetId, edge)
    if (orderedIds.join("|") === currentIds.join("|")) {
      return
    }

    const rank = new Map(orderedIds.map((id, index) => [id, index]))
    const previous = rows
    setRows((prev) =>
      [...prev].sort((a, b) => {
        const ra = rank.get(a.id)
        const rb = rank.get(b.id)
        if (ra === undefined || rb === undefined) {
          return a.position - b.position
        }

        return ra - rb
      }),
    )
    startTransition(async () => {
      const result = await reorderEnumOptionsAction(orgSlug, kind, orderedIds)
      if (result.status === "error") {
        toast({ variant: "error", title: result.message })
        setRows(previous)
      }
    })
  }

  const runReorderRef = useRef(runReorder)
  useEffect(() => {
    runReorderRef.current = runReorder
  })

  useEffect(() => {
    if (!canEdit) {
      return
    }

    return monitorForElements({
      canMonitor: ({ source }) => isRowDragData(source.data) && source.data.kind === kind,
      onDrop: ({ source, location }) => {
        const target = location.current.dropTargets[0]
        if (target === undefined || !isRowDragData(source.data) || !isRowDragData(target.data)) {
          return
        }

        if (source.data.id === target.data.id) {
          return
        }

        runReorderRef.current(source.data.id, target.data.id, extractClosestEdge(target.data))
      },
    })
  }, [kind, canEdit])

  const patchOption = (id: string, patch: { label?: string; color?: ColorToken; defaultProbability?: number | null }) => {
    const previous = rows
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, ...normalizeLocal(patch) } : row)))
    startTransition(async () => {
      const result = await updateEnumOptionAction(orgSlug, id, patch)
      if (result.status === "error") {
        toast({ variant: "error", title: result.message })
        setRows(previous)
      }
    })
  }

  const archive = (id: string) => {
    const previous = rows
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, archivedAt: new Date().toISOString() } : row)))
    startTransition(async () => {
      const result = await archiveEnumOptionAction(orgSlug, id)
      if (result.status === "error") {
        toast({ variant: "error", title: result.message })
        setRows(previous)
      }
    })
  }

  const unarchive = (id: string) => {
    const previous = rows
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, archivedAt: undefined } : row)))
    startTransition(async () => {
      const result = await unarchiveEnumOptionAction(orgSlug, id)
      if (result.status === "error") {
        toast({ variant: "error", title: result.message })
        setRows(previous)
      }
    })
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <h3 className="text-[14px] font-semibold tracking-tight text-foreground">{title}</h3>
        <span className="rounded-full bg-surface-3/70 px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-muted">
          {active.length}
        </span>
      </div>

      <div className="flex flex-col gap-1.5">
        {active.map((option) => (
          <OptionRow
            key={option.id}
            option={option}
            kind={kind}
            isDealStage={isDealStage}
            canEdit={canEdit}
            onLabelChange={(label) => patchOption(option.id, { label })}
            onColorChange={(color) => patchOption(option.id, { color })}
            onProbabilityChange={(defaultProbability) => patchOption(option.id, { defaultProbability })}
            onArchive={() => archive(option.id)}
          />
        ))}
      </div>

      {canEdit ? <AddOptionRow kind={kind} orgSlug={orgSlug} /> : null}

      {archived.length > 0 ? (
        <div className="mt-1 rounded-xl border border-hairline bg-surface-2/40">
          <button
            type="button"
            onClick={() => setArchivedOpen((open) => !open)}
            className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-[12px] font-medium text-muted transition-colors hover:text-foreground"
          >
            <ChevronDown
              className={cn("size-3.5 shrink-0 transition-transform", archivedOpen ? "" : "-rotate-90")}
            />
            Archivované
            <span className="tabular-nums text-muted-soft">{archived.length}</span>
          </button>
          {archivedOpen ? (
            <div className="flex flex-col gap-1.5 px-3 pb-3">
              {archived.map((option) => {
                const style = optionBadgeStyle(option)

                return (
                  <div key={option.id} className="flex items-center gap-2 opacity-60">
                    <span aria-hidden className={cn("size-2 shrink-0 rounded-full", style.dot)} />
                    <span className="min-w-0 flex-1 truncate text-[13px] text-foreground">{option.label}</span>
                    {canEdit ? (
                      <button
                        type="button"
                        onClick={() => unarchive(option.id)}
                        className="inline-flex cursor-pointer items-center gap-1 rounded-md px-1.5 py-1 text-[12px] text-muted transition-colors hover:bg-surface-3/70 hover:text-foreground"
                      >
                        <ArchiveRestore className="size-3.5" />
                        Obnovit
                      </button>
                    ) : null}
                  </div>
                )
              })}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}

function normalizeLocal(patch: {
  label?: string
  color?: ColorToken
  defaultProbability?: number | null
}): Partial<EnumOption> {
  const next: Partial<EnumOption> = {}
  if (patch.label !== undefined) {
    next.label = patch.label
  }

  if (patch.color !== undefined) {
    next.color = patch.color
  }

  if (patch.defaultProbability !== undefined) {
    next.defaultProbability = patch.defaultProbability ?? undefined
  }

  return next
}

interface OptionRowProps {
  option: EnumOption
  kind: EnumKind
  isDealStage: boolean
  canEdit: boolean
  onLabelChange: (label: string) => void
  onColorChange: (color: ColorToken) => void
  onProbabilityChange: (probability: number | null) => void
  onArchive: () => void
}

function OptionRow({
  option,
  kind,
  isDealStage,
  canEdit,
  onLabelChange,
  onColorChange,
  onProbabilityChange,
  onArchive,
}: OptionRowProps) {
  const [editingLabel, setEditingLabel] = useState(false)
  const [labelDraft, setLabelDraft] = useState(option.label)
  const handleRef = useRef<HTMLButtonElement | null>(null)
  const rowRef = useRef<HTMLDivElement | null>(null)
  const [closestEdge, setClosestEdge] = useState<Edge | null>(null)
  const [dragging, setDragging] = useState(false)
  const locked = isRequired(kind, option.semantic)

  useEffect(() => {
    setLabelDraft(option.label)
  }, [option.label])

  useEffect(() => {
    const handle = handleRef.current
    const row = rowRef.current
    if (handle === null || row === null || !canEdit) {
      return
    }

    return combine(
      draggable({
        element: row,
        dragHandle: handle,
        getInitialData: () => rowDragData(kind, option.id),
        onDragStart: () => setDragging(true),
        onDrop: () => setDragging(false),
      }),
      dropTargetForElements({
        element: row,
        canDrop: ({ source }) => isRowDragData(source.data) && source.data.kind === kind,
        getIsSticky: () => true,
        getData: ({ input, element }) =>
          attachClosestEdge(rowDragData(kind, option.id), {
            input,
            element,
            allowedEdges: ["top", "bottom"],
          }),
        onDrag: ({ self, source }) => {
          if (isRowDragData(source.data) && source.data.id === option.id) {
            setClosestEdge(null)

            return
          }

          setClosestEdge(extractClosestEdge(self.data))
        },
        onDragLeave: () => setClosestEdge(null),
        onDrop: () => setClosestEdge(null),
      }),
    )
  }, [kind, option.id, canEdit])

  const commitLabel = () => {
    const trimmed = labelDraft.trim()
    setEditingLabel(false)
    if (trimmed.length === 0 || trimmed === option.label) {
      setLabelDraft(option.label)

      return
    }

    onLabelChange(trimmed)
  }

  const style = optionBadgeStyle(option)

  return (
    <div
      ref={rowRef}
      className={cn(
        "relative flex items-center gap-2 rounded-xl border border-hairline bg-surface px-2.5 py-2 transition-shadow",
        dragging && "opacity-40",
      )}
    >
      {closestEdge === "top" ? <EdgeLine position="top" /> : null}
      {closestEdge === "bottom" ? <EdgeLine position="bottom" /> : null}

      {canEdit ? (
        <button
          ref={handleRef}
          type="button"
          aria-label="Přetáhnout pro změnu pořadí"
          className="flex size-6 shrink-0 cursor-grab items-center justify-center rounded-md text-muted-soft transition-colors hover:bg-surface-3/70 hover:text-muted active:cursor-grabbing"
        >
          <GripVertical className="size-4" />
        </button>
      ) : (
        <span className="size-6 shrink-0" />
      )}

      <ColorPicker color={option.color} disabled={!canEdit} onSelect={onColorChange} />

      {editingLabel && canEdit ? (
        <input
          autoFocus
          value={labelDraft}
          onChange={(event) => setLabelDraft(event.target.value)}
          onBlur={commitLabel}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault()
              commitLabel()
            } else if (event.key === "Escape") {
              event.preventDefault()
              setLabelDraft(option.label)
              setEditingLabel(false)
            }
          }}
          className="min-w-0 flex-1 rounded-md border border-primary bg-surface px-2 py-1 text-[13px] text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/20"
        />
      ) : (
        <button
          type="button"
          disabled={!canEdit}
          onClick={() => setEditingLabel(true)}
          className={cn(
            "min-w-0 flex-1 truncate rounded-md px-2 py-1 text-left text-[13px] text-foreground transition-colors",
            canEdit ? "cursor-pointer hover:bg-surface-3/50" : "cursor-default",
          )}
        >
          {option.label}
        </button>
      )}

      {isDealStage ? (
        <DealGroupTag semantic={option.semantic} />
      ) : null}

      {isDealStage ? (
        <ProbabilityInput
          value={option.defaultProbability}
          disabled={!canEdit}
          onCommit={onProbabilityChange}
        />
      ) : null}

      {canEdit ? (
        locked ? (
          <span
            className="flex size-7 shrink-0 items-center justify-center text-muted-soft"
            title="Tuto hodnotu vyžaduje aplikace, nelze ji archivovat"
          >
            <Lock className="size-3.5" />
          </span>
        ) : (
          <button
            type="button"
            aria-label="Archivovat"
            onClick={onArchive}
            className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-soft transition-colors hover:bg-surface-3/70 hover:text-foreground"
          >
            <Archive className="size-3.5" />
          </button>
        )
      ) : (
        <span className="flex size-7 shrink-0 items-center justify-center">
          <span aria-hidden className={cn("size-1.5 rounded-full", style.dot)} />
        </span>
      )}
    </div>
  )
}

function EdgeLine({ position }: { position: "top" | "bottom" }) {
  return (
    <div
      className={cn(
        "absolute inset-x-2 h-0.5 rounded-full bg-primary/70",
        position === "top" ? "-top-1" : "-bottom-1",
      )}
    />
  )
}

function DealGroupTag({ semantic }: { semantic: string | undefined }) {
  const badge = dealGroupBadge(semantic)

  return (
    <span
      className={cn(
        "hidden shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium sm:inline-flex",
        badge.className,
      )}
    >
      {badge.label}
    </span>
  )
}

function ProbabilityInput({
  value,
  disabled,
  onCommit,
}: {
  value: number | undefined
  disabled: boolean
  onCommit: (probability: number | null) => void
}) {
  const [draft, setDraft] = useState(value === undefined ? "" : String(value))

  useEffect(() => {
    setDraft(value === undefined ? "" : String(value))
  }, [value])

  const commit = () => {
    const trimmed = draft.trim()
    if (trimmed.length === 0) {
      if (value !== undefined) {
        onCommit(null)
      }

      return
    }

    const parsed = Number.parseInt(trimmed, 10)
    if (Number.isNaN(parsed) || parsed < 0 || parsed > 100) {
      setDraft(value === undefined ? "" : String(value))

      return
    }

    if (parsed !== value) {
      onCommit(parsed)
    }
  }

  return (
    <div className="flex shrink-0 items-center gap-1">
      <input
        inputMode="numeric"
        value={draft}
        disabled={disabled}
        placeholder="—"
        onChange={(event) => setDraft(event.target.value.replace(/[^0-9]/g, ""))}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault()
            commit()
          }
        }}
        className="h-8 w-12 rounded-md border border-border-strong/60 bg-surface px-1.5 text-center text-[13px] tabular-nums text-foreground transition-[border-color,box-shadow] duration-150 focus-visible:border-primary focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/20 disabled:opacity-50"
      />
      <span className="text-[12px] text-muted-soft">%</span>
    </div>
  )
}

function ColorPicker({
  color,
  disabled,
  onSelect,
}: {
  color: ColorToken
  disabled: boolean
  onSelect: (color: ColorToken) => void
}) {
  const [open, setOpen] = useState(false)
  const current = optionBadgeStyle({ label: "", color })

  if (disabled) {
    return <span aria-hidden className={cn("size-4 shrink-0 rounded-full", current.dot)} />
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Změnit barvu"
          className="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-md transition-colors hover:bg-surface-3/70"
        >
          <span aria-hidden className={cn("size-4 rounded-full ring-1 ring-hairline", current.dot)} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-2">
        <div className="grid grid-cols-5 gap-1.5">
          {COLOR_TOKENS.map((token) => {
            const style = optionBadgeStyle({ label: "", color: token })

            return (
              <button
                key={token}
                type="button"
                aria-label={token}
                onClick={() => {
                  setOpen(false)
                  if (token !== color) {
                    onSelect(token)
                  }
                }}
                className={cn(
                  "flex size-7 cursor-pointer items-center justify-center rounded-md transition-transform hover:scale-110",
                  token === color && "ring-2 ring-primary ring-offset-1 ring-offset-surface",
                )}
              >
                <span aria-hidden className={cn("size-4 rounded-full", style.dot)} />
              </button>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}

function AddOptionRow({ kind, orgSlug }: { kind: EnumKind; orgSlug: string }) {
  const { toast } = useToast()
  const [label, setLabel] = useState("")
  const [value, setValue] = useState("")
  const [valueTouched, setValueTouched] = useState(false)
  const [color, setColor] = useState<ColorToken>("slate")
  const [pending, startTransition] = useTransition()

  const effectiveValue = valueTouched ? value : slugifyValue(label)
  const trimmedLabel = label.trim()
  const valueValid = VALUE_PATTERN.test(effectiveValue)
  const canSubmit = trimmedLabel.length > 0 && valueValid && !pending

  const reset = () => {
    setLabel("")
    setValue("")
    setValueTouched(false)
    setColor("slate")
  }

  const submit = () => {
    if (!canSubmit) {
      return
    }

    startTransition(async () => {
      const result = await createEnumOptionAction(orgSlug, kind, {
        value: effectiveValue,
        label: trimmedLabel,
        color,
      })
      if (result.status === "success") {
        toast({ variant: "success", title: result.message })
        reset()
      } else if (result.status === "error") {
        toast({ variant: "error", title: result.message })
      }
    })
  }

  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-dashed border-border-strong/60 p-2.5">
      <div className="flex items-center gap-2">
        <ColorPicker color={color} disabled={false} onSelect={setColor} />
        <Input
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault()
              submit()
            }
          }}
          placeholder="Nová hodnota"
          className="h-9 flex-1 rounded-lg text-[13px]"
        />
        <Button type="button" size="sm" onClick={submit} disabled={!canSubmit}>
          {pending ? <Spinner className="size-4" /> : <Plus className="size-4" />}
          Přidat
        </Button>
      </div>
      <div className="flex items-center gap-2 pl-8">
        <span className="text-[11px] text-muted-soft">Hodnota</span>
        <input
          value={effectiveValue}
          onChange={(event) => {
            setValueTouched(true)
            setValue(event.target.value)
          }}
          spellCheck={false}
          placeholder="value_slug"
          className={cn(
            "h-7 w-48 rounded-md border bg-surface px-2 font-mono text-[12px] text-muted transition-[border-color,box-shadow] duration-150 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/20",
            effectiveValue.length > 0 && !valueValid
              ? "border-danger focus-visible:border-danger"
              : "border-border-strong/60 focus-visible:border-primary",
          )}
        />
        {effectiveValue.length > 0 && !valueValid ? (
          <span className="text-[11px] text-danger">jen a-z, 0-9, _; začíná písmenem</span>
        ) : null}
      </div>
    </div>
  )
}
