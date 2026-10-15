"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useToast } from "@/app/_ui/Toast"
import { cn } from "@/lib/cn"
import type { KeyboardEvent } from "react"
import type { ActionState } from "@/app/_lib/actionState"

interface InlineEditCellProps {
  value: string | undefined
  ariaLabel: string
  onSave: (value: string) => Promise<ActionState>
  inputType?: "text" | "tel" | "email"
}

// The owning column must set `cellClassName: "p-0 relative"`: this component fills the
// whole cell via absolute positioning, so the edit surface reaches every cell edge and
// entering the edit mode cannot shift the text by a pixel.
const CELL_FILL = "absolute inset-0 flex items-center px-3"

// Invisible in-flow copy of the value: absolutely positioned content adds no width or
// height, so this keeps the column sized to its content and the row at normal height.
function CellSizer({ value }: { value: string | undefined }) {
  return (
    <span aria-hidden className="invisible block whitespace-nowrap px-3 py-2.5 text-[13px] leading-5">
      {value !== undefined && value.length > 0 ? value : "-"}
    </span>
  )
}


// Seamless inline editing for Browser datagrid cells. The resting state is plain cell
// text; clicking anywhere in the cell turns the WHOLE cell white and the caret lands
// in place. No box, no border, no radius, no size change. Enter or blur saves through
// the given server action, Escape cancels.
export function InlineEditCell({
  value,
  ariaLabel,
  onSave,
  inputType = "text",
}: InlineEditCellProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState("")
  const [pending, startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [editing])

  const beginEdit = () => {
    setDraft(value ?? "")
    setEditing(true)
  }

  const save = () => {
    const next = draft.trim()
    if (next === (value ?? "")) {
      setEditing(false)

      return
    }

    startTransition(async () => {
      const result = await onSave(next)
      if (result.status === "error") {
        // Discard the rejected draft: the cell falls back to the stored value.
        toast({ variant: "error", title: result.message })
        setEditing(false)

        return
      }

      setEditing(false)
      router.refresh()
    })
  }

  const onInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault()
      save()
    } else if (event.key === "Escape") {
      event.preventDefault()
      setEditing(false)
    }
  }

  if (editing) {
    return (
      <>
        <CellSizer value={value} />
        <div
          className={cn(CELL_FILL, "bg-surface")}
          onClick={(event) => event.stopPropagation()}
        >
          <input
            ref={inputRef}
            type={inputType}
            value={draft}
            disabled={pending}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={onInputKeyDown}
            onBlur={save}
            aria-label={ariaLabel}
            className="block w-full bg-transparent p-0 text-[13px] leading-5 text-foreground outline-none disabled:opacity-60"
          />
        </div>
      </>
    )
  }

  return (
    <>
      <CellSizer value={value} />
      <div
        onClick={(event) => {
          event.stopPropagation()
          beginEdit()
        }}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault()
            beginEdit()
          }
        }}
        aria-label={ariaLabel}
        className={cn(
          CELL_FILL,
          "cursor-text ring-inset transition-shadow hover:bg-surface hover:ring-1 hover:ring-border-strong/50",
        )}
      >
        {value === undefined || value.length === 0 ? (
          <span className="text-[13px] leading-5 text-muted-soft">-</span>
        ) : (
          <span className="truncate text-[13px] leading-5 text-foreground">{value}</span>
        )}
      </div>
    </>
  )
}
