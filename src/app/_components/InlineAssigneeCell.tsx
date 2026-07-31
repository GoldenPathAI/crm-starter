"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { UserPlus } from "lucide-react"
import type { OrgMember } from "@/core/types/crm.types"
import type { ActionState } from "@/app/_lib/actionState"
import { AssigneePicker } from "@/app/_components/AssigneePicker"
import { AvatarStack } from "@/app/_components/AvatarStack"
import { useToast } from "@/app/_ui/Toast"
import { cn } from "@/lib/cn"

interface InlineAssigneeCellProps {
  // Current assignees as resolved by the server for this row.
  assignees: OrgMember[]
  // All assignable org members.
  members: OrgMember[]
  // Persists the full desired assignee id list for the row's entity.
  onSave: (userIds: string[]) => Promise<ActionState>
  align?: "start" | "end"
}

const idsOf = (members: OrgMember[]): string[] => members.map((member) => member.userId)

// Quick-assign directly from a datagrid row: shows the current assignees (or a placeholder) and
// opens the shared member picker to toggle assignment without opening the entity detail. Writes
// optimistically and reverts on error. Reusable for any assignee field (úkoly, pipeline, ...).
export function InlineAssigneeCell({
  assignees,
  members,
  onSave,
  align = "start",
}: InlineAssigneeCellProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [selected, setSelected] = useState<string[]>(idsOf(assignees))
  const [pending, startTransition] = useTransition()

  // Resync when the server row changes (e.g. after refresh or an edit elsewhere), unless a write
  // is mid-flight and holding the optimistic value.
  const serverIds = idsOf(assignees).join(",")
  useEffect(() => {
    if (!pending) {
      setSelected(idsOf(assignees))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverIds])

  const memberById = new Map(members.map((member) => [member.userId, member]))
  const current = selected
    .map((id) => memberById.get(id))
    .filter((member): member is OrgMember => member !== undefined)

  const commit = (next: string[]) => {
    const previous = selected
    setSelected(next)
    startTransition(async () => {
      const result = await onSave(next)
      if (result.status === "error") {
        setSelected(previous)
        toast({ variant: "error", title: result.message })
      } else {
        router.refresh()
      }
    })
  }

  const toggle = (userId: string) =>
    commit(selected.includes(userId) ? selected.filter((id) => id !== userId) : [...selected, userId])

  return (
    <span onClick={(event) => event.stopPropagation()}>
      <AssigneePicker
        members={members}
        selected={selected}
        onToggle={toggle}
        onClear={() => commit([])}
        align={align}
        trigger={
          <button
            type="button"
            aria-label="Přiřadit řešitele"
            className={cn(
              "inline-flex cursor-pointer items-center gap-1 rounded-lg px-2 py-1 transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/20",
              pending && "opacity-60",
            )}
          >
            {current.length > 0 ? (
              <AvatarStack members={current} />
            ) : (
              <span className="inline-flex items-center gap-1 text-[13px] text-muted-soft transition-colors hover:text-foreground">
                <UserPlus className="size-3.5" />
                Přiřadit
              </span>
            )}
          </button>
        }
      />
    </span>
  )
}
