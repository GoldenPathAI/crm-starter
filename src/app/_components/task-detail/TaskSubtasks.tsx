"use client"

import { useState, type KeyboardEvent } from "react"
import { ChevronRight, Plus, Trash2 } from "lucide-react"
import { Checkbox } from "@/app/_ui/Checkbox"
import { AvatarStack } from "@/app/_components/AvatarStack"
import { formatCzechDate } from "@/lib/dates"
import { cn } from "@/lib/cn"
import type { TaskSubtask } from "./types"

interface TaskSubtasksProps {
  subtasks: TaskSubtask[]
  today: string
  heading?: string
  addPlaceholder?: string
  onOpen: (subtaskId: string) => void
  onToggle: (subtaskId: string) => void
  onAdd: (title: string) => void
  onDelete: (subtaskId: string) => void
}

export function TaskSubtasks({
  subtasks,
  today,
  heading = "Podúkoly",
  addPlaceholder = "Přidat podúkol",
  onOpen,
  onToggle,
  onAdd,
  onDelete,
}: TaskSubtasksProps) {
  const [draft, setDraft] = useState("")
  const done = subtasks.filter((subtask) => subtask.done).length

  const commit = () => {
    const value = draft.trim()
    if (value.length === 0) {
      return
    }

    onAdd(value)
    setDraft("")
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault()
      commit()
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <h3 className="text-[13px] font-semibold text-foreground">{heading}</h3>
        {subtasks.length > 0 ? (
          <span className="rounded-full bg-surface-3/70 px-2 py-0.5 text-[11px] font-medium tabular-nums text-muted">
            {done}/{subtasks.length}
          </span>
        ) : null}
      </div>

      {subtasks.length > 0 ? (
        <div className="flex flex-col">
          {subtasks.map((subtask) => {
            const overdue = subtask.dueAt !== null && !subtask.done && subtask.dueAt < today

            return (
              <div
                key={subtask.id}
                role="button"
                tabIndex={0}
                onClick={() => onOpen(subtask.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault()
                    onOpen(subtask.id)
                  }
                }}
                className={cn(
                  "group flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-surface-2",
                  subtask.pending === true && "pointer-events-none opacity-60",
                )}
              >
                <span className="flex items-center" onClick={(event) => event.stopPropagation()}>
                  <Checkbox checked={subtask.done} onCheckedChange={() => onToggle(subtask.id)} />
                </span>
                <span
                  className={cn(
                    "min-w-0 truncate text-[13px] transition-colors",
                    subtask.done ? "text-muted-soft line-through" : "text-foreground",
                  )}
                >
                  {subtask.title}
                </span>
                <ChevronRight className="size-3.5 shrink-0 text-muted-soft opacity-0 transition-opacity group-hover:opacity-100" />
                <span className="flex-1" />
                {subtask.dueAt !== null ? (
                  <span
                    className={cn(
                      "shrink-0 text-xs tabular-nums",
                      overdue ? "font-medium text-red-text" : "text-muted-soft",
                    )}
                  >
                    {formatCzechDate(subtask.dueAt)}
                  </span>
                ) : null}
                {subtask.assignees.length > 0 ? (
                  <AvatarStack members={subtask.assignees} className="shrink-0" />
                ) : null}
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation()
                    onDelete(subtask.id)
                  }}
                  aria-label="Smazat podúkol"
                  className="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-soft opacity-0 transition-[color,background-color,opacity] hover:bg-danger-soft hover:text-danger focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 group-hover:opacity-100 [@media(pointer:coarse)]:opacity-100"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            )
          })}
        </div>
      ) : null}

      <div className="flex items-center gap-2 rounded-lg px-2 py-1">
        <Plus className="size-3.5 shrink-0 text-muted-soft" />
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={commit}
          placeholder={addPlaceholder}
          autoComplete="off"
          className="h-6 w-full bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-soft"
        />
      </div>
    </div>
  )
}
