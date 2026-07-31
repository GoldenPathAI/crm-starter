"use client"

import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { Markdown } from "@/app/_ui/Markdown"
import { cn } from "@/lib/cn"
import type { KeyboardEvent } from "react"

interface DescriptionEditorProps {
  value: string
  onCommit: (value: string) => void
  placeholder?: string
  className?: string
}

// Long-text description with markdown: the resting state renders the markdown,
// clicking it (or the placeholder) switches to a plain auto-growing textarea in
// place. Blur or Cmd+Enter commits, Escape cancels.
export function DescriptionEditor({
  value,
  onCommit,
  placeholder = "Přidat popis",
  className,
}: DescriptionEditorProps) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)

  useEffect(() => {
    if (!editing) {
      setDraft(value)
    }
  }, [value, editing])

  useLayoutEffect(() => {
    if (editing) {
      const node = ref.current
      if (node !== null) {
        node.focus()
        node.setSelectionRange(node.value.length, node.value.length)
        node.style.height = "auto"
        node.style.height = `${node.scrollHeight}px`
      }
    }
  }, [editing, draft])

  const commit = () => {
    setEditing(false)
    if (draft !== value) {
      onCommit(draft)
    }
  }

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault()
      commit()
    } else if (event.key === "Escape") {
      event.preventDefault()
      setDraft(value)
      setEditing(false)
    }
  }

  if (editing) {
    return (
      <textarea
        ref={ref}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        rows={3}
        className={cn(
          "w-full resize-none rounded-lg bg-surface-2/60 px-2 py-1.5 text-[13px] leading-relaxed text-foreground outline-none placeholder:text-muted-soft",
          className,
        )}
      />
    )
  }

  if (value.trim().length === 0) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className={cn(
          "w-full cursor-text rounded-lg px-2 py-1.5 text-left text-[13px] text-muted-soft transition-colors hover:bg-surface-2/60",
          className,
        )}
      >
        {placeholder}
      </button>
    )
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => setEditing(true)}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault()
          setEditing(true)
        }
      }}
      className={cn(
        "cursor-text rounded-lg px-2 py-1.5 transition-colors hover:bg-surface-2/40",
        className,
      )}
    >
      <Markdown text={value} />
    </div>
  )
}
