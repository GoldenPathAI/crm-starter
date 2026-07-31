"use client"

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react"
import { useOrg } from "@/app/_components/org/OrgProvider"
import { todayIso } from "@/lib/dates"
import { loadTaskOptionsAction } from "./actions"
import { TaskDetailModal, type TaskModalState } from "./TaskDetailModal"
import type { TaskCreateContext, TaskDetailOptions } from "./types"

interface TaskDetailContextValue {
  openTask: (ticketId: string) => void
  createTask: (context?: TaskCreateContext) => void
}

const TaskDetailContext = createContext<TaskDetailContextValue | null>(null)

export function useTaskDetail(): TaskDetailContextValue {
  const value = useContext(TaskDetailContext)
  if (value === null) {
    throw new Error("useTaskDetail must be used within a TaskDetailProvider")
  }
  return value
}

export function TaskDetailProvider({ children }: { children: React.ReactNode }) {
  const { orgSlug } = useOrg()
  const [state, setState] = useState<TaskModalState | null>(null)
  const [options, setOptions] = useState<TaskDetailOptions | null>(null)
  const loadingOptions = useRef(false)
  const [today] = useState(() => todayIso())

  const ensureOptions = useCallback(() => {
    if (options !== null || loadingOptions.current) {
      return
    }
    loadingOptions.current = true
    void loadTaskOptionsAction(orgSlug)
      .then(setOptions)
      .finally(() => {
        loadingOptions.current = false
      })
  }, [options, orgSlug])

  const openTask = useCallback(
    (ticketId: string) => {
      ensureOptions()
      setState({ mode: "edit", ticketId })
    },
    [ensureOptions],
  )

  const createTask = useCallback(
    (context?: TaskCreateContext) => {
      ensureOptions()
      setState({ mode: "create", context: context ?? {} })
    },
    [ensureOptions],
  )

  const value = useMemo<TaskDetailContextValue>(
    () => ({ openTask, createTask }),
    [openTask, createTask],
  )

  return (
    <TaskDetailContext.Provider value={value}>
      {children}
      {state !== null ? (
        <TaskDetailModal
          state={state}
          options={options}
          today={today}
          onClose={() => setState(null)}
        />
      ) : null}
    </TaskDetailContext.Provider>
  )
}
