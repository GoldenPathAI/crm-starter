"use client"

import { Plus } from "lucide-react"
import { Button } from "@/app/_ui/Button"
import { useTaskDetail } from "@/app/_components/task-detail/TaskDetailProvider"

export function NewTicketButton() {
  const { createTask } = useTaskDetail()

  return (
    <Button size="sm" onClick={() => createTask()}>
      <Plus className="size-4" />
      Nový úkol
    </Button>
  )
}
