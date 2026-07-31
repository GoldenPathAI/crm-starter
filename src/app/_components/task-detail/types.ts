import type {
  EnumOption,
  OrgMember,
  TicketPriority,
  TicketRecurrence,
  TicketStatus,
} from "@/core/types/crm.types"

export interface TaskOption {
  value: string
  label: string
}

export interface TaskDetailOptions {
  clients: TaskOption[]
  projectsByClient: Record<string, TaskOption[]>
  statusOptions: EnumOption[]
  priorityOptions: EnumOption[]
  members: OrgMember[]
}

export interface TaskSubtask {
  id: string
  title: string
  done: boolean
  dueAt: string | null
  assignees: OrgMember[]
  // Optimistically appended row awaiting its server id; interactions are held off.
  pending?: boolean
}

export interface TaskDetailData {
  id: string
  clientId: string
  clientName: string
  projectId: string | null
  projectName: string | null
  parent: { id: string; title: string } | null
  title: string
  description: string
  status: TicketStatus
  priority: TicketPriority
  dueAt: string | null
  labels: string[]
  recurrence: TicketRecurrence | null
  assignees: OrgMember[]
  subtasks: TaskSubtask[]
}

export interface TaskFieldPatch {
  title?: string
  description?: string | null
  status?: TicketStatus
  priority?: TicketPriority
  dueAt?: string | null
  labels?: string[]
  recurrence?: TicketRecurrence | null
  clientId?: string
  projectId?: string | null
}

export interface TaskCreateContext {
  clientId?: string
  projectId?: string
  status?: TicketStatus
}

export interface CreateTaskInput {
  clientId: string
  projectId: string
  title: string
  description: string
  status: TicketStatus
  priority: TicketPriority
  dueAt: string
  labels: string[]
  recurrence: string
}
