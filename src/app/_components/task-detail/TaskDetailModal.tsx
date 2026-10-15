"use client"

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useTransition,
  type KeyboardEvent,
  type Ref,
} from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Check, ChevronRight, MoreHorizontal, Repeat, Trash2 } from "lucide-react"
import { useOrg } from "@/app/_components/org/OrgProvider"
import { useUndoToast } from "@/app/_lib/useUndoToast"
import { orgHref } from "@/lib/nav"
import { Button } from "@/app/_ui/Button"
import { ConfirmDialog } from "@/app/_ui/ConfirmDialog"
import { DescriptionEditor } from "@/app/_ui/DescriptionEditor"
import { Dialog, DialogContent, DialogTitle } from "@/app/_ui/Dialog"
import { Popover, PopoverContent, PopoverTrigger } from "@/app/_ui/Popover"
import { Spinner } from "@/app/_ui/Spinner"
import { ToastVariant, useToast } from "@/app/_ui/Toast"
import { cn } from "@/lib/cn"
import type { OrgMember, TicketRecurrence, TicketStatus } from "@/core/types/crm.types"
import { HistorySection } from "@/app/_components/HistorySection"
import {
  addSubtaskAction,
  createTaskAction,
  deleteTaskAction,
  loadTaskAction,
  loadTaskHistoryAction,
  patchTaskAction,
  setTicketAssigneesAction,
  toggleSubtaskAction,
} from "./actions"
import { useTaskDetail } from "./TaskDetailProvider"
import { TaskProperties } from "./TaskProperties"
import { TaskSubtasks } from "./TaskSubtasks"
import type {
  TaskCreateContext,
  TaskDetailData,
  TaskDetailOptions,
  TaskFieldPatch,
} from "./types"

export type TaskModalState =
  | { mode: "edit"; ticketId: string }
  | { mode: "create"; context: TaskCreateContext }

interface TaskDetailModalProps {
  state: TaskModalState
  options: TaskDetailOptions | null
  today: string
  onClose: () => void
}

interface CreateDraft {
  clientId: string
  projectId: string | null
  title: string
  description: string
  status: TicketStatus
  priority: TaskDetailData["priority"]
  dueAt: string | null
  labels: string[]
  recurrence: TicketRecurrence | null
}

const RECURRENCE_OPTIONS: ReadonlyArray<{ value: TicketRecurrence | null; label: string }> = [
  { value: null, label: "Žádné" },
  { value: "weekly", label: "Týdně" },
  { value: "biweekly", label: "Každé 2 týdny" },
  { value: "monthly", label: "Měsíčně" },
  { value: "quarterly", label: "Čtvrtletně" },
]

const projectClientMap = (options: TaskDetailOptions | null): Record<string, string> => {
  const map: Record<string, string> = {}
  if (options === null) {
    return map
  }

  for (const [clientId, projects] of Object.entries(options.projectsByClient)) {
    for (const project of projects) {
      map[project.value] = clientId
    }
  }

  return map
}

const applyPatch = (
  data: TaskDetailData,
  patch: TaskFieldPatch,
  options: TaskDetailOptions | null,
): TaskDetailData => {
  const next: TaskDetailData = { ...data }
  if (patch.title !== undefined) {
    next.title = patch.title
  }

  if (patch.description !== undefined) {
    next.description = patch.description ?? ""
  }

  if (patch.status !== undefined) {
    next.status = patch.status
  }

  if (patch.priority !== undefined) {
    next.priority = patch.priority
  }

  if (patch.dueAt !== undefined) {
    next.dueAt = patch.dueAt
  }

  if (patch.labels !== undefined) {
    next.labels = patch.labels
  }

  if (patch.recurrence !== undefined) {
    next.recurrence = patch.recurrence
  }

  if (patch.projectId !== undefined) {
    next.projectId = patch.projectId
    if (patch.projectId === null) {
      next.projectName = null
    } else if (options !== null) {
      const owner = projectClientMap(options)[patch.projectId]
      const projectOptions = owner !== undefined ? options.projectsByClient[owner] ?? [] : []
      next.projectName = projectOptions.find((p) => p.value === patch.projectId)?.label ?? next.projectName
      if (owner !== undefined) {
        next.clientId = owner
        next.clientName = options.clients.find((c) => c.value === owner)?.label ?? next.clientName
      }
    }
  }

  if (patch.clientId !== undefined && options !== null) {
    next.clientId = patch.clientId
    next.clientName = options.clients.find((c) => c.value === patch.clientId)?.label ?? patch.clientId
  }

  return next
}

export function TaskDetailModal({ state, options, today, onClose }: TaskDetailModalProps) {
  const { toast } = useToast()

  return (
    <Dialog open onOpenChange={(next) => (next ? undefined : onClose())}>
      <DialogContent className="max-w-[760px]">
        <DialogTitle className="sr-only">
          {state.mode === "edit" ? "Detail úkolu" : "Nový úkol"}
        </DialogTitle>
        {state.mode === "edit" ? (
          <EditView ticketId={state.ticketId} options={options} today={today} onClose={onClose} toast={toast} />
        ) : (
          <CreateView context={state.context} options={options} today={today} onClose={onClose} toast={toast} />
        )}
      </DialogContent>
    </Dialog>
  )
}

type ToastFn = ReturnType<typeof useToast>["toast"]

function EditView({
  ticketId,
  options,
  today,
  onClose,
  toast,
}: {
  ticketId: string
  options: TaskDetailOptions | null
  today: string
  onClose: () => void
  toast: ToastFn
}) {
  const { orgSlug } = useOrg()
  const { openTask } = useTaskDetail()
  const { toastWithUndo } = useUndoToast()
  const router = useRouter()
  const [data, setData] = useState<TaskDetailData | null>(null)
  const [loading, setLoading] = useState(true)
  const [menuOpen, setMenuOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [, startSave] = useTransition()

  const reload = useCallback(async () => {
    const fresh = await loadTaskAction(orgSlug, ticketId)
    setData(fresh)
    setLoading(false)
  }, [orgSlug, ticketId])

  useEffect(() => {
    setLoading(true)
    setData(null)
    void reload()
  }, [reload])

  const savePatch = (patch: TaskFieldPatch) => {
    if (data === null) {
      return
    }

    const previous = data
    setData(applyPatch(data, patch, options))
    startSave(async () => {
      const result = await patchTaskAction(orgSlug, { ticketId, patch })
      if (result.status === "error") {
        setData(previous)
        toast({ variant: ToastVariant.Error, title: result.message })
      }
    })
  }

  const saveTitle = (title: string) => {
    if (data === null) {
      return
    }

    const trimmed = title.trim()
    if (trimmed.length === 0 || trimmed === data.title) {
      return
    }

    savePatch({ title: trimmed })
  }

  const saveDescription = (description: string) => {
    if (data === null || description === data.description) {
      return
    }

    savePatch({ description: description.length > 0 ? description : null })
  }

  const saveAssignees = (userIds: string[]) => {
    if (data === null) {
      return
    }

    const previous = data
    const nextAssignees = userIds
      .map((id) => options?.members.find((member) => member.userId === id))
      .filter((member): member is OrgMember => member !== undefined)
      .sort((a, b) => a.name.localeCompare(b.name, "cs"))
    setData({ ...data, assignees: nextAssignees })
    startSave(async () => {
      const result = await setTicketAssigneesAction(orgSlug, ticketId, userIds)
      if (result.status === "error") {
        setData(previous)
        toast({ variant: ToastVariant.Error, title: result.message })
      }
    })
  }

  const toggleSubtask = (subtaskId: string) => {
    if (data === null) {
      return
    }

    const previous = data
    setData({
      ...data,
      subtasks: data.subtasks.map((subtask) =>
        subtask.id === subtaskId ? { ...subtask, done: !subtask.done } : subtask,
      ),
    })
    startSave(async () => {
      const result = await toggleSubtaskAction(orgSlug, { subtaskId })
      if (result.status === "error") {
        setData(previous)
        toast({ variant: ToastVariant.Error, title: result.message })
      }
    })
  }

  const addSubtask = (title: string) => {
    if (data === null) {
      return
    }

    const tempId = `temp_${Date.now()}`
    setData({
      ...data,
      subtasks: [
        ...data.subtasks,
        { id: tempId, title, done: false, dueAt: null, assignees: [], pending: true },
      ],
    })
    startSave(async () => {
      const result = await addSubtaskAction(orgSlug, { parentId: ticketId, title })
      if (result.status === "error") {
        setData((current) =>
          current === null
            ? current
            : {
                ...current,
                subtasks: current.subtasks.filter((subtask) => subtask.id !== tempId),
              },
        )
        toast({ variant: ToastVariant.Error, title: result.message })

        return
      }

      await reload()
    })
  }

  const deleteSubtask = (subtaskId: string) => {
    if (data === null) {
      return
    }

    const previous = data
    setData({ ...data, subtasks: data.subtasks.filter((subtask) => subtask.id !== subtaskId) })
    startSave(async () => {
      const result = await deleteTaskAction(orgSlug, { ticketId: subtaskId })
      if (result.status === "error") {
        setData(previous)
        toast({ variant: ToastVariant.Error, title: result.message })
      } else if (result.status === "success") {
        toastWithUndo(result, () => void reload())
      }
    })
  }

  const remove = async () => {
    const result = await deleteTaskAction(orgSlug, { ticketId })
    if (result.status === "success") {
      toastWithUndo(result, () => router.refresh())
      onClose()
    } else if (result.status === "error") {
      toast({ variant: ToastVariant.Error, title: result.message })
    }
  }

  if (loading || data === null) {
    if (!loading && data === null) {
      return <p className="py-10 text-center text-[13px] text-muted-soft">Úkol nebyl nalezen</p>
    }

    return (
      <div className="flex items-center justify-center py-16">
        <Spinner className="size-5 text-muted-soft" />
      </div>
    )
  }

  const isSubtask = data.parent !== null

  return (
    <div className="flex flex-col gap-5">
      <TopBar
        clientId={data.clientId}
        clientName={data.clientName}
        projectId={data.projectId}
        projectName={data.projectName}
        parent={data.parent}
        onClose={onClose}
        actions={
          <>
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
                <div className="flex min-w-44 flex-col gap-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false)
                      setConfirmOpen(true)
                    }}
                    className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm text-danger transition-colors hover:bg-danger-soft"
                  >
                    <Trash2 className="size-3.5 shrink-0" />
                    Smazat úkol
                  </button>
                </div>
              </PopoverContent>
            </Popover>
            <ConfirmDialog
              open={confirmOpen}
              onOpenChange={setConfirmOpen}
              title="Smazat úkol"
              description={
                data.subtasks.length > 0
                  ? `Smazáním se odstraní i podúkoly (${data.subtasks.length}). Akci nelze vzít zpět.`
                  : "Úkol bude nevratně smazán."
              }
              confirmLabel="Smazat úkol"
              onConfirm={remove}
              destructive
            />
          </>
        }
      />

      <TitleInput value={data.title} onCommit={saveTitle} />

      <TaskProperties
        values={data}
        clientName={data.clientName}
        clientEditable={data.projectId === null && !isSubtask}
        clientOptions={options?.clients ?? []}
        projectOptions={options?.projectsByClient[data.clientId] ?? []}
        projectEditable={!isSubtask}
        projectName={data.projectName}
        statusOptions={options?.statusOptions ?? []}
        priorityOptions={options?.priorityOptions ?? []}
        today={today}
        onPatch={savePatch}
        members={options?.members ?? []}
        assignees={data.assignees}
        onAssigneesChange={saveAssignees}
      />

      {isSubtask ? null : (
        <RecurrenceRow
          value={data.recurrence}
          onChange={(recurrence) => savePatch({ recurrence })}
        />
      )}

      <div className="h-px bg-border" />

      <DescriptionEditor
        value={data.description}
        onCommit={saveDescription}
        placeholder="Přidat popis"
      />

      {isSubtask ? null : (
        <>
          <div className="h-px bg-border" />
          <TaskSubtasks
            subtasks={data.subtasks}
            today={today}
            onOpen={openTask}
            onToggle={toggleSubtask}
            onAdd={addSubtask}
            onDelete={deleteSubtask}
          />
        </>
      )}

      <div className="h-px bg-border" />

      <HistorySection key={ticketId} load={() => loadTaskHistoryAction(orgSlug, ticketId)} />
    </div>
  )
}

function CreateView({
  context,
  options,
  today,
  onClose,
  toast,
}: {
  context: TaskCreateContext
  options: TaskDetailOptions | null
  today: string
  onClose: () => void
  toast: ToastFn
}) {
  const { orgSlug } = useOrg()
  const initialClient =
    context.clientId ??
    (context.projectId !== undefined ? projectClientMap(options)[context.projectId] : undefined) ??
    ""
  const [draft, setDraft] = useState<CreateDraft>({
    clientId: initialClient,
    projectId: context.projectId ?? null,
    title: "",
    description: "",
    status: context.status ?? "todo",
    priority: "stredni",
    dueAt: null,
    labels: [],
    recurrence: null,
  })
  const [submitting, startSubmit] = useTransition()
  const [errors, setErrors] = useState<{ title?: string; client?: string }>({})
  const titleInputRef = useRef<HTMLInputElement>(null)

  // Options load lazily; when they arrive, resolve the client a prefilled
  // project belongs to so the Klient row is populated in board-column create.
  useEffect(() => {
    if (draft.clientId.length > 0 || draft.projectId === null || options === null) {
      return
    }

    const owner = projectClientMap(options)[draft.projectId]
    if (owner !== undefined) {
      setDraft((prev) => ({ ...prev, clientId: owner }))
    }
  }, [options, draft.clientId, draft.projectId])

  // The initial status/priority literals are seed defaults; once the org's
  // options load, snap any value the org does not offer to its semantic default
  // (todo status, medium priority) so create is valid for every workspace.
  useEffect(() => {
    if (options === null) {
      return
    }

    setDraft((prev) => {
      const statusOk = options.statusOptions.some((option) => option.value === prev.status)
      const priorityOk = options.priorityOptions.some((option) => option.value === prev.priority)
      if (statusOk && priorityOk) {
        return prev
      }

      const nextStatus = statusOk
        ? prev.status
        : (options.statusOptions.find((option) => option.semantic === "todo") ??
            options.statusOptions[0])?.value ?? prev.status
      const nextPriority = priorityOk
        ? prev.priority
        : (options.priorityOptions.find((option) => option.semantic === "medium") ??
            options.priorityOptions[0])?.value ?? prev.priority

      return { ...prev, status: nextStatus, priority: nextPriority }
    })
  }, [options])

  const patch = (fields: TaskFieldPatch) => {
    if (fields.title !== undefined && fields.title.trim().length > 0) {
      setErrors((prev) => (prev.title === undefined ? prev : { ...prev, title: undefined }))
    }

    if (fields.clientId !== undefined || fields.projectId !== undefined) {
      setErrors((prev) => (prev.client === undefined ? prev : { ...prev, client: undefined }))
    }

    setDraft((prev) => {
      const next = { ...prev }
      if (fields.title !== undefined) {
        next.title = fields.title
      }

      if (fields.description !== undefined) {
        next.description = fields.description ?? ""
      }

      if (fields.status !== undefined) {
        next.status = fields.status
      }

      if (fields.priority !== undefined) {
        next.priority = fields.priority
      }

      if (fields.dueAt !== undefined) {
        next.dueAt = fields.dueAt
      }

      if (fields.labels !== undefined) {
        next.labels = fields.labels
      }

      if (fields.recurrence !== undefined) {
        next.recurrence = fields.recurrence
      }

      if (fields.clientId !== undefined) {
        next.clientId = fields.clientId
        next.projectId = null
      }

      if (fields.projectId !== undefined) {
        next.projectId = fields.projectId
      }

      return next
    })
  }

  const clientName = options?.clients.find((c) => c.value === draft.clientId)?.label ?? ""
  const projectName =
    draft.projectId !== null
      ? options?.projectsByClient[draft.clientId]?.find((p) => p.value === draft.projectId)?.label ?? null
      : null

  const submit = () => {
    const nextErrors: { title?: string; client?: string } = {}
    if (draft.title.trim().length === 0) {
      nextErrors.title = "Vyplňte název úkolu."
    }

    if (draft.clientId.length === 0 && draft.projectId === null) {
      nextErrors.client = "Vyberte klienta."
    }

    if (nextErrors.title !== undefined || nextErrors.client !== undefined) {
      setErrors(nextErrors)
      if (nextErrors.title !== undefined) {
        titleInputRef.current?.focus()
      }

      return
    }

    setErrors({})
    startSubmit(async () => {
      const result = await createTaskAction(orgSlug, {
        clientId: draft.clientId,
        projectId: draft.projectId ?? "",
        title: draft.title,
        description: draft.description,
        status: draft.status,
        priority: draft.priority,
        dueAt: draft.dueAt ?? "",
        labels: draft.labels,
        recurrence: draft.recurrence ?? "",
      })
      if (result.status === "success") {
        toast({ variant: ToastVariant.Success, title: result.message })
        onClose()
      } else if (result.status === "error") {
        toast({ variant: ToastVariant.Error, title: result.message })
      }
    })
  }

  return (
    <div className="flex flex-col gap-5">
      <TopBar
        clientId={draft.clientId.length > 0 ? draft.clientId : null}
        clientName={clientName}
        projectId={draft.projectId}
        projectName={projectName}
        parent={null}
        onClose={onClose}
      />

      <TitleInput
        value={draft.title}
        placeholder="Název úkolu"
        autoFocus
        error={errors.title}
        inputRef={titleInputRef}
        onChange={(title) => patch({ title })}
      />

      <TaskProperties
        values={draft}
        clientName={clientName}
        clientEditable
        clientOptions={options?.clients ?? []}
        projectOptions={options?.projectsByClient[draft.clientId] ?? []}
        statusOptions={options?.statusOptions ?? []}
        priorityOptions={options?.priorityOptions ?? []}
        today={today}
        onPatch={patch}
      />

      <RecurrenceRow
        value={draft.recurrence}
        onChange={(recurrence) => patch({ recurrence })}
      />

      {errors.client !== undefined ? (
        <p className="text-xs font-medium text-danger">{errors.client}</p>
      ) : null}

      <div className="h-px bg-border" />

      <DescriptionField value={draft.description} onChange={(description) => patch({ description })} />

      <div className="flex justify-end pt-1">
        <Button type="button" size="sm" onClick={submit} disabled={submitting}>
          {submitting ? <Spinner className="size-4" /> : null}
          Vytvořit úkol
        </Button>
      </div>
    </div>
  )
}

function TopBar({
  clientId,
  clientName,
  projectId,
  projectName,
  parent,
  actions,
  onClose,
}: {
  clientId: string | null
  clientName: string
  projectId: string | null
  projectName: string | null
  parent: { id: string; title: string } | null
  actions?: React.ReactNode
  onClose: () => void
}) {
  const { orgSlug } = useOrg()
  const { openTask } = useTaskDetail()

  return (
    <div className="flex items-center justify-between gap-3 pr-8">
      <nav className="flex min-w-0 flex-wrap items-center gap-1 text-xs text-muted">
        {parent !== null ? (
          <>
            <span className="text-muted-soft">Podúkol</span>
            <ChevronRight className="size-3 shrink-0 text-muted-soft" />
            <button
              type="button"
              onClick={() => openTask(parent.id)}
              className="cursor-pointer truncate text-muted transition-colors hover:text-foreground"
            >
              {parent.title}
            </button>
          </>
        ) : (
          <>
            {clientId !== null && clientName.length > 0 ? (
              <Link
                href={orgHref(orgSlug, `/klienti/${clientId}`)}
                onClick={onClose}
                className="truncate transition-colors hover:text-foreground"
              >
                {clientName}
              </Link>
            ) : (
              <span className="text-muted-soft">Nový úkol</span>
            )}
            {projectId !== null && projectName !== null ? (
              <>
                <ChevronRight className="size-3 shrink-0 text-muted-soft" />
                <Link
                  href={orgHref(orgSlug, `/projekty/${projectId}`)}
                  onClick={onClose}
                  className="truncate transition-colors hover:text-foreground"
                >
                  {projectName}
                </Link>
              </>
            ) : null}
          </>
        )}
      </nav>
      {actions !== undefined ? <div className="flex shrink-0 items-center gap-1">{actions}</div> : null}
    </div>
  )
}

function TitleInput({
  value,
  placeholder = "Název úkolu",
  autoFocus,
  error,
  inputRef,
  onChange,
  onCommit,
}: {
  value: string
  placeholder?: string
  autoFocus?: boolean
  error?: string
  inputRef?: Ref<HTMLInputElement>
  onChange?: (value: string) => void
  onCommit?: (value: string) => void
}) {
  const [local, setLocal] = useState(value)

  useEffect(() => {
    setLocal(value)
  }, [value])

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault()
      event.currentTarget.blur()
    }
  }

  const invalid = error !== undefined && error.length > 0

  return (
    <div className="flex flex-col gap-1.5">
      <input
        ref={inputRef}
        value={onChange !== undefined ? value : local}
        onChange={(event) => {
          setLocal(event.target.value)
          onChange?.(event.target.value)
        }}
        onBlur={() => onCommit?.(local)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoFocus={autoFocus}
        autoComplete="off"
        aria-invalid={invalid || undefined}
        className="w-full bg-transparent font-display text-2xl font-semibold tracking-tight text-foreground outline-none placeholder:text-muted-soft aria-[invalid=true]:placeholder:text-danger/70"
      />
      {invalid ? <p className="text-xs font-medium text-danger">{error}</p> : null}
    </div>
  )
}

// Mirrors the TaskProperties row layout (96px label column) so the field reads as
// part of the same property grid without touching the shared TaskProperties surface.
function RecurrenceRow({
  value,
  onChange,
}: {
  value: TicketRecurrence | null
  onChange: (value: TicketRecurrence | null) => void
}) {
  const [open, setOpen] = useState(false)
  const activeLabel =
    RECURRENCE_OPTIONS.find((option) => option.value === value)?.label ?? "Žádné"

  return (
    <div className="grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2">
      <div className="grid grid-cols-[96px_1fr] items-center gap-2">
        <span className="text-[13px] text-muted-soft">Opakování</span>
        <div className="min-w-0">
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className={cn(
                  "inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1.5 text-[13px] transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/20",
                  value === null ? "text-muted-soft" : "text-foreground",
                )}
              >
                <Repeat className="size-3.5" />
                {activeLabel}
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-auto p-1">
              <div className="flex min-w-44 flex-col gap-0.5">
                {RECURRENCE_OPTIONS.map((option) => {
                  const isActive = option.value === value

                  return (
                    <button
                      key={option.value ?? "none"}
                      type="button"
                      onClick={() => {
                        onChange(option.value)
                        setOpen(false)
                      }}
                      className={cn(
                        "flex cursor-pointer items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors",
                        isActive
                          ? "bg-primary-soft text-primary"
                          : "text-foreground hover:bg-surface-2",
                      )}
                    >
                      {option.label}
                      {isActive ? <Check className="size-4 shrink-0" /> : null}
                    </button>
                  )
                })}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </div>
  )
}

function DescriptionField({
  value,
  onChange,
  onCommit,
}: {
  value: string
  onChange?: (value: string) => void
  onCommit?: (value: string) => void
}) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const [local, setLocal] = useState(value)

  useEffect(() => {
    setLocal(value)
  }, [value])

  const resize = useCallback(() => {
    const node = ref.current
    if (node !== null) {
      node.style.height = "auto"
      node.style.height = `${node.scrollHeight}px`
    }
  }, [])

  useLayoutEffect(() => {
    resize()
  }, [resize, local])

  const current = onChange !== undefined ? value : local

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault()
      event.currentTarget.blur()
    }
  }

  return (
    <textarea
      ref={ref}
      value={current}
      onChange={(event) => {
        setLocal(event.target.value)
        onChange?.(event.target.value)
      }}
      onBlur={() => onCommit?.(local)}
      onKeyDown={handleKeyDown}
      rows={2}
      placeholder="Přidej popis..."
      className="w-full resize-none bg-transparent text-sm leading-relaxed text-foreground outline-none placeholder:text-muted-soft"
    />
  )
}
