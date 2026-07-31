"use client"

import { useOptimistic, useTransition } from "react"
import { CalendarClock, Plus } from "lucide-react"
import { Button } from "@/app/_ui/Button"
import { Card, CardContent, CardHeader, CardTitle } from "@/app/_ui/Card"
import { Checkbox } from "@/app/_ui/Checkbox"
import { useToast } from "@/app/_ui/Toast"
import { useTaskDetail } from "@/app/_components/task-detail/TaskDetailProvider"
import { AvatarStack } from "@/app/_components/AvatarStack"
import { formatCzechDate } from "@/lib/dates"
import { cn } from "@/lib/cn"
import { useOrg } from "@/app/_components/org/OrgProvider"
import type { TicketWithAssignees } from "@/core/types/crm.types"
import { badgeFor, type EnumView } from "../../_lib/enums"
import { setClientTaskStatusAction } from "../clientTaskActions"

interface ClientTasksCardProps {
  clientId: string
  tasks: TicketWithAssignees[]
  today: string
  priorityView: EnumView
}

const isOverdue = (task: TicketWithAssignees, today: string): boolean =>
  task.dueAt !== undefined && task.status !== "done" && task.dueAt < today

export function ClientTasksCard({ clientId, tasks, today, priorityView }: ClientTasksCardProps) {
  const { orgSlug } = useOrg()
  const { toast } = useToast()
  const { openTask, createTask } = useTaskDetail()
  const [, startTransition] = useTransition()
  // Checking a task marks it done optimistically (the row leaves the open list
  // right away); the transition end restores server truth after revalidation.
  const [optimisticTasks, markTaskDone] = useOptimistic(
    tasks,
    (current: TicketWithAssignees[], ticketId: string) =>
      current.map((task) => (task.id === ticketId ? { ...task, status: "done" } : task)),
  )

  const openTasks = optimisticTasks
    .filter((task) => task.parentId === undefined && task.status !== "done")
    .sort((a, b) => {
      const aDue = a.dueAt ?? "9999-99-99"
      const bDue = b.dueAt ?? "9999-99-99"
      return aDue.localeCompare(bDue)
    })

  const complete = (ticketId: string) => {
    startTransition(async () => {
      markTaskDone(ticketId)
      const result = await setClientTaskStatusAction(orgSlug, { ticketId, clientId, status: "done" })
      if (result.status === "error") {
        toast({ variant: "error", title: result.message })
      }
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Úkoly</CardTitle>
        <div className="flex items-center gap-3">
          <span className="text-[13px] tabular-nums text-muted-soft">{openTasks.length}</span>
          <Button size="sm" variant="ghost" onClick={() => createTask({ clientId })}>
            <Plus className="size-4" />
            Nový úkol
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {openTasks.length > 0 ? (
          openTasks.map((task) => {
            const overdue = isOverdue(task, today)
            const priority = badgeFor(priorityView, task.priority)
            return (
              <div
                key={task.id}
                onClick={() => openTask(task.id)}
                className="group flex cursor-pointer items-start gap-3 border-b border-hairline pb-3 last:border-0 last:pb-0"
              >
                <div className="pt-0.5" onClick={(event) => event.stopPropagation()}>
                  <Checkbox checked={false} onCheckedChange={() => complete(task.id)} />
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <span className="text-sm font-medium leading-snug text-foreground transition-colors group-hover:text-primary">
                    {task.title}
                  </span>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="inline-flex items-center gap-1.5 text-xs text-muted">
                      <span aria-hidden className={cn("size-[7px] rounded-full", priority.dot)} />
                      {priority.label}
                    </span>
                    {task.dueAt !== undefined ? (
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 text-xs tabular-nums",
                          overdue ? "font-medium text-red-text" : "text-muted-soft",
                        )}
                      >
                        {overdue ? <CalendarClock className="size-3" /> : null}
                        {formatCzechDate(task.dueAt)}
                      </span>
                    ) : null}
                  </div>
                </div>
                {task.assignees.length > 0 ? (
                  <AvatarStack members={task.assignees} className="pt-0.5" />
                ) : null}
              </div>
            )
          })
        ) : (
          <p className="text-[13px] text-muted-soft">Žádné otevřené úkoly</p>
        )}
      </CardContent>
    </Card>
  )
}
