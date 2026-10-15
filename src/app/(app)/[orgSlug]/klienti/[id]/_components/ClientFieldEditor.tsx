"use client"

import { useEffect, useRef, useState, useTransition, type KeyboardEvent } from "react"
import { Pencil } from "lucide-react"
import { ExpandToggle } from "@/app/_ui/ExpandableText"
import { Input } from "@/app/_ui/Input"
import { Textarea } from "@/app/_ui/Textarea"
import { ToastVariant, useToast } from "@/app/_ui/Toast"
import { idleState } from "@/app/_lib/actionState"
import { useClampedOverflow } from "@/app/_lib/useClampedOverflow"
import { useOrg } from "@/app/_components/org/OrgProvider"
import { cn } from "@/lib/cn"
import { updateClientFieldAction } from "../actions"

interface ClientFieldEditorProps {
  clientId: string
  field: "nextStep" | "note"
  label: string
  value: string | undefined
  multiline?: boolean
}

const caretToEnd = (node: HTMLInputElement | HTMLTextAreaElement) => {
  const end = node.value.length
  node.setSelectionRange(end, end)
}

export function ClientFieldEditor({
  clientId,
  field,
  label,
  value,
  multiline,
}: ClientFieldEditorProps) {
  const { orgSlug } = useOrg()
  const { toast } = useToast()
  const [current, setCurrent] = useState(value)
  const [editing, setEditing] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [draft, setDraft] = useState("")
  // Escape must cancel without the follow-up blur committing the draft.
  const cancelledRef = useRef(false)
  const [, startSave] = useTransition()
  const { ref: textRef, overflowing } = useClampedOverflow<HTMLSpanElement>(
    expanded || multiline !== true,
    current ?? "",
  )

  useEffect(() => {
    setCurrent(value)
  }, [value])

  const beginEdit = () => {
    setDraft(current ?? "")
    cancelledRef.current = false
    setEditing(true)
  }

  const commit = () => {
    if (cancelledRef.current) {
      cancelledRef.current = false

      return
    }

    setEditing(false)
    const next = draft.trim()
    if (next === (current ?? "")) {
      return
    }

    const previous = current
    setCurrent(next.length > 0 ? next : undefined)
    startSave(async () => {
      const formData = new FormData()
      formData.set("clientId", clientId)
      formData.set("field", field)
      formData.set("value", next)
      const result = await updateClientFieldAction(orgSlug, idleState, formData)
      if (result.status === "error") {
        setCurrent(previous)
        toast({ variant: ToastVariant.Error, title: result.message })
      }
    })
  }

  const cancel = () => {
    cancelledRef.current = true
    setEditing(false)
  }

  const handleInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault()
      event.currentTarget.blur()
    } else if (event.key === "Escape") {
      event.preventDefault()
      cancel()
    }
  }

  const handleTextareaKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault()
      event.currentTarget.blur()
    } else if (event.key === "Escape") {
      event.preventDefault()
      cancel()
    }
  }

  if (editing) {
    return multiline === true ? (
      <Textarea
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={handleTextareaKeyDown}
        onFocus={(event) => caretToEnd(event.currentTarget)}
        rows={4}
        autoFocus
        aria-label={label}
      />
    ) : (
      <Input
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={handleInputKeyDown}
        onFocus={(event) => caretToEnd(event.currentTarget)}
        autoFocus
        autoComplete="off"
        aria-label={label}
      />
    )
  }

  const isEmpty = current === undefined || current.length === 0
  const clamped = multiline === true && !expanded

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={beginEdit}
        aria-label={`Upravit ${label.toLowerCase()}`}
        title={`Upravit ${label.toLowerCase()}`}
        className="group -mx-2 -my-1 flex w-full cursor-pointer items-start justify-between gap-2 rounded-lg px-2 py-1 text-left transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <span
          ref={textRef}
          className={cn(
            "whitespace-pre-wrap break-words",
            clamped && "line-clamp-4",
            isEmpty && "text-muted-soft",
          )}
        >
          {isEmpty ? "Doplnit..." : current}
        </span>
        <Pencil className="mt-1 size-3.5 shrink-0 text-muted-soft opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 [@media(pointer:coarse)]:opacity-100" />
      </button>
      {multiline === true && (overflowing || expanded) ? (
        <ExpandToggle expanded={expanded} onToggle={() => setExpanded(!expanded)} />
      ) : null}
    </div>
  )
}
