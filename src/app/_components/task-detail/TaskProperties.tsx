"use client"

import { useState, type KeyboardEvent, type ReactNode } from "react"
import { addDays, format, parseISO } from "date-fns"
import { CalendarPlus, Check, ChevronDown, Tag, UserPlus, X } from "lucide-react"
import { DatePicker } from "@/app/_ui/DatePicker"
import { EntityAvatar } from "@/app/_ui/Avatar"
import { Popover, PopoverContent, PopoverTrigger } from "@/app/_ui/Popover"
import { AvatarStack } from "@/app/_components/AvatarStack"
import { AssigneePicker } from "@/app/_components/AssigneePicker"
import { badgeStyleFor, optionBadgeStyle, styleMap } from "@/lib/crm/config"
import { formatCzechDate } from "@/lib/dates"
import { cn } from "@/lib/cn"
import type { EnumOption, OrgMember, TicketPriority, TicketStatus } from "@/core/types/crm.types"
import { SearchableSelect } from "./SearchableSelect"
import type { TaskFieldPatch, TaskOption } from "./types"

export interface TaskPropertyValues {
  clientId: string
  projectId: string | null
  status: TicketStatus
  priority: TicketPriority
  dueAt: string | null
  labels: string[]
}

interface TaskPropertiesProps {
  values: TaskPropertyValues
  clientName: string
  clientEditable: boolean
  clientOptions: TaskOption[]
  projectOptions: TaskOption[]
  projectEditable?: boolean
  projectName?: string | null
  statusOptions: EnumOption[]
  priorityOptions: EnumOption[]
  today: string
  onPatch: (patch: TaskFieldPatch) => void
  members?: OrgMember[]
  assignees?: OrgMember[]
  onAssigneesChange?: (userIds: string[]) => void
}

const PROJECT_NONE = "__none__"

export function TaskProperties({
  values,
  clientName,
  clientEditable,
  clientOptions,
  projectOptions,
  projectEditable = true,
  projectName,
  statusOptions,
  priorityOptions,
  today,
  onPatch,
  members,
  assignees,
  onAssigneesChange,
}: TaskPropertiesProps) {
  const doneStatusValue = statusOptions.find((option) => option.semantic === "done")?.value
  const overdue =
    values.dueAt !== null && values.status !== doneStatusValue && values.dueAt < today
  const showAssignees =
    members !== undefined && assignees !== undefined && onAssigneesChange !== undefined

  return (
    <div className="grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2">
      <PropertyRow label="Stav">
        <OptionChipSelect
          value={values.status}
          options={statusOptions}
          onSelect={(status) => onPatch({ status })}
        />
      </PropertyRow>

      <PropertyRow label="Priorita">
        <OptionChipSelect
          value={values.priority}
          options={priorityOptions}
          onSelect={(priority) => onPatch({ priority })}
        />
      </PropertyRow>

      {showAssignees ? (
        <PropertyRow label="Řeší">
          <AssigneeControl members={members} assignees={assignees} onChange={onAssigneesChange} />
        </PropertyRow>
      ) : null}

      <PropertyRow label="Termín">
        <DueControl
          value={values.dueAt}
          overdue={overdue}
          today={today}
          onChange={(dueAt) => onPatch({ dueAt: dueAt.length > 0 ? dueAt : null })}
        />
      </PropertyRow>

      <PropertyRow label="Klient">
        {clientEditable ? (
          <SearchableSelect
            value={values.clientId}
            options={clientOptions}
            placeholder="Vyberte klienta"
            renderIcon={(option) => <EntityAvatar name={option.label} seed={option.value} />}
            onChange={(clientId) => onPatch({ clientId, projectId: null })}
          />
        ) : (
          <span className="flex min-w-0 items-center gap-2 px-2 py-1.5 text-[13px] text-muted">
            {clientName.length > 0 ? (
              <EntityAvatar name={clientName} seed={values.clientId} />
            ) : null}
            <span className="truncate">{clientName}</span>
          </span>
        )}
      </PropertyRow>

      <PropertyRow label="Projekt">
        {projectEditable ? (
          <SearchableSelect
            value={values.projectId ?? PROJECT_NONE}
            options={[{ value: PROJECT_NONE, label: "Bez projektu" }, ...projectOptions]}
            placeholder="Bez projektu"
            disabled={values.clientId.length === 0}
            onChange={(projectId) =>
              onPatch({ projectId: projectId === PROJECT_NONE ? null : projectId })
            }
          />
        ) : (
          <span className="block truncate px-2 py-1.5 text-[13px] text-muted">
            {projectName ?? "Bez projektu"}
          </span>
        )}
      </PropertyRow>

      <PropertyRow label="Štítky" align="start" className="sm:col-span-2">
        <LabelsField labels={values.labels} onChange={(labels) => onPatch({ labels })} />
      </PropertyRow>
    </div>
  )
}

function PropertyRow({
  label,
  align = "center",
  className,
  children,
}: {
  label: string
  align?: "center" | "start"
  className?: string
  children: ReactNode
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-[96px_1fr] gap-2",
        align === "center" ? "items-center" : "items-start",
        className,
      )}
    >
      <span className={cn("text-[13px] text-muted-soft", align === "start" && "pt-2")}>{label}</span>
      <div className="min-w-0">{children}</div>
    </div>
  )
}

interface OptionChipSelectProps {
  value: string
  options: EnumOption[]
  onSelect: (value: string) => void
}

function OptionChipSelect({ value, options, onSelect }: OptionChipSelectProps) {
  const [open, setOpen] = useState(false)
  const activeStyle = badgeStyleFor(value, styleMap(options))

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1 transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/20"
        >
          <span
            className={cn(
              "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium",
              activeStyle.badge,
            )}
          >
            <span aria-hidden className={cn("size-[7px] shrink-0 rounded-full", activeStyle.dot)} />
            {activeStyle.label}
          </span>
          <ChevronDown className="size-3.5 text-muted-soft" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-1">
        <div className="flex min-w-44 flex-col gap-0.5">
          {options.map((option) => {
            const optionStyle = optionBadgeStyle(option)
            const isActive = option.value === value
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onSelect(option.value)
                  setOpen(false)
                }}
                className={cn(
                  "flex cursor-pointer items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors",
                  isActive ? "bg-primary-soft text-primary" : "text-foreground hover:bg-surface-2",
                )}
              >
                <span className="flex items-center gap-2">
                  <span aria-hidden className={cn("size-[7px] shrink-0 rounded-full", optionStyle.dot)} />
                  {option.label}
                </span>
                {isActive ? <Check className="size-4 shrink-0" /> : null}
              </button>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}

interface AssigneeControlProps {
  members: OrgMember[]
  assignees: OrgMember[]
  onChange: (userIds: string[]) => void
}

function AssigneeControl({ members, assignees, onChange }: AssigneeControlProps) {
  const selected = assignees.map((member) => member.userId)

  const toggle = (userId: string) => {
    onChange(
      selected.includes(userId)
        ? selected.filter((id) => id !== userId)
        : [...selected, userId],
    )
  }

  return (
    <AssigneePicker
      members={members}
      selected={selected}
      onToggle={toggle}
      onClear={() => onChange([])}
      trigger={
        <button
          type="button"
          className="inline-flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/20"
        >
          {assignees.length > 0 ? (
            <>
              <AvatarStack members={assignees} />
              <span className="truncate text-[13px] text-muted">
                {assignees.map((member) => member.name).join(", ")}
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
  )
}

interface DueControlProps {
  value: string | null
  overdue: boolean
  today: string
  onChange: (iso: string) => void
}

function DueControl({ value, overdue, today, onChange }: DueControlProps) {
  const [open, setOpen] = useState(false)
  const todayDate = parseISO(today)
  const presets: Array<{ label: string; iso: string }> = [
    { label: "Dnes", iso: today },
    { label: "Zítra", iso: format(addDays(todayDate, 1), "yyyy-MM-dd") },
    { label: "Za týden", iso: format(addDays(todayDate, 7), "yyyy-MM-dd") },
  ]

  const apply = (iso: string) => {
    onChange(iso)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1.5 text-[13px] transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/20",
            value === null && "text-muted-soft",
            value !== null && (overdue ? "font-medium text-red-text" : "text-foreground"),
          )}
        >
          {value !== null ? (
            <span className="tabular-nums">{formatCzechDate(value)}</span>
          ) : (
            <span className="inline-flex items-center gap-1.5">
              <CalendarPlus className="size-3.5" />
              Přidat termín
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-2">
        <div className="flex min-w-52 flex-col gap-0.5">
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
          <DatePicker value={value} onChange={(iso) => apply(iso)} placeholder="Jiné datum" />
          {value !== null ? (
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

interface LabelsFieldProps {
  labels: string[]
  onChange: (labels: string[]) => void
}

function LabelsField({ labels, onChange }: LabelsFieldProps) {
  const [draft, setDraft] = useState("")
  const [adding, setAdding] = useState(false)

  const commit = () => {
    const value = draft.trim()
    if (value.length > 0 && !labels.includes(value)) {
      onChange([...labels, value])
    }
    setDraft("")
    setAdding(false)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault()
      commit()
    } else if (event.key === "Escape") {
      setDraft("")
      setAdding(false)
    } else if (event.key === "Backspace" && draft.length === 0 && labels.length > 0) {
      onChange(labels.slice(0, -1))
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 py-1">
      {labels.map((label) => (
        <span
          key={label}
          className="inline-flex items-center gap-1 rounded-full bg-surface-3/60 py-0.5 pl-2.5 pr-1 text-xs font-medium text-muted"
        >
          {label}
          <button
            type="button"
            onClick={() => onChange(labels.filter((entry) => entry !== label))}
            aria-label={`Odebrat štítek ${label}`}
            className="flex size-4 cursor-pointer items-center justify-center rounded-full transition-colors hover:bg-hairline hover:text-foreground"
          >
            <X className="size-3" />
          </button>
        </span>
      ))}
      {adding ? (
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={commit}
          placeholder="štítek"
          autoFocus
          autoComplete="off"
          className="h-6 min-w-24 flex-1 bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-soft"
        />
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="inline-flex cursor-pointer items-center gap-1 rounded-lg px-2 py-1 text-[13px] text-muted-soft transition-colors hover:bg-surface-2 hover:text-foreground"
        >
          <Tag className="size-3.5" />
          {labels.length === 0 ? "Přidat štítek" : "Přidat"}
        </button>
      )}
    </div>
  )
}
