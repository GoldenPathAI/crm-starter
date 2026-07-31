import {
  activities,
  clients,
  deals,
  documents,
  enumOptions,
  people,
  projects,
  rapportEntries,
  tickets,
} from "@/lib/db/schema/crm"
import type {
  Activity,
  Client,
  Deal,
  Doc,
  EnumOption,
  Person,
  Project,
  RapportEntry,
  Ticket,
} from "@/core/types/crm.types"

type ClientRow = typeof clients.$inferSelect
type PersonRow = typeof people.$inferSelect
type RapportEntryRow = typeof rapportEntries.$inferSelect
type DealRow = typeof deals.$inferSelect
type ProjectRow = typeof projects.$inferSelect
type TicketRow = typeof tickets.$inferSelect
type ActivityRow = typeof activities.$inferSelect
type DocRow = typeof documents.$inferSelect
type EnumOptionRow = typeof enumOptions.$inferSelect

export const toClient = (row: ClientRow): Client => ({
  id: row.id,
  organizationId: row.organizationId,
  name: row.name,
  ico: row.ico ?? undefined,
  dic: row.dic ?? undefined,
  website: row.website ?? undefined,
  industry: row.industry,
  street: row.street ?? undefined,
  city: row.city ?? undefined,
  zip: row.zip ?? undefined,
  status: row.status,
  services: row.services,
  billingEmail: row.billingEmail ?? undefined,
  mrrCzk: row.mrrCzk ?? undefined,
  nextStep: row.nextStep ?? undefined,
  lastContactAt: row.lastContactAt ?? undefined,
  note: row.note ?? undefined,
  labels: row.labels,
  createdByUserId: row.createdByUserId ?? undefined,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
})

export const toPerson = (row: PersonRow): Person => ({
  id: row.id,
  organizationId: row.organizationId,
  clientId: row.clientId ?? undefined,
  name: row.name,
  kind: row.kind,
  role: row.role ?? undefined,
  email: row.email ?? undefined,
  phone: row.phone ?? undefined,
  note: row.note ?? undefined,
  isPrimary: row.isPrimary,
  createdByUserId: row.createdByUserId ?? undefined,
  createdAt: row.createdAt.toISOString(),
})

export const toRapportEntry = (row: RapportEntryRow): RapportEntry => ({
  id: row.id,
  organizationId: row.organizationId,
  personId: row.personId,
  kind: row.kind,
  content: row.content,
  happenedAt: row.happenedAt ?? undefined,
  createdByUserId: row.createdByUserId ?? undefined,
  createdAt: row.createdAt.toISOString(),
})

export const toDeal = (row: DealRow): Deal => ({
  id: row.id,
  organizationId: row.organizationId,
  clientId: row.clientId,
  title: row.title,
  stage: row.stage,
  order: row.order,
  valueCzk: row.valueCzk,
  probability: row.probability ?? undefined,
  expectedClose: row.expectedClose ?? undefined,
  nextStep: row.nextStep ?? undefined,
  description: row.description ?? undefined,
  stageChangedAt: row.stageChangedAt.toISOString(),
  lostReason: row.lostReason ?? undefined,
  offerUrl: row.offerUrl ?? undefined,
  createdByUserId: row.createdByUserId ?? undefined,
  createdAt: row.createdAt.toISOString(),
})

export const toProject = (row: ProjectRow): Project => ({
  id: row.id,
  organizationId: row.organizationId,
  clientId: row.clientId,
  dealId: row.dealId ?? undefined,
  name: row.name,
  description: row.description ?? undefined,
  status: row.status,
  startedAt: row.startedAt ?? undefined,
  dueAt: row.dueAt ?? undefined,
  budgetCzk: row.budgetCzk ?? undefined,
  createdByUserId: row.createdByUserId ?? undefined,
})

export const toTicket = (row: TicketRow): Ticket => ({
  id: row.id,
  organizationId: row.organizationId,
  clientId: row.clientId,
  projectId: row.projectId ?? undefined,
  dealId: row.dealId ?? undefined,
  parentId: row.parentId ?? undefined,
  title: row.title,
  description: row.description ?? undefined,
  status: row.status,
  priority: row.priority,
  dueAt: row.dueAt ?? undefined,
  order: row.order,
  labels: row.labels,
  recurrence: row.recurrence ?? undefined,
  createdByUserId: row.createdByUserId ?? undefined,
  createdAt: row.createdAt.toISOString(),
  doneAt: row.doneAt === null ? undefined : row.doneAt.toISOString(),
})

export const toActivity = (row: ActivityRow): Activity => ({
  id: row.id,
  organizationId: row.organizationId,
  clientId: row.clientId,
  dealId: row.dealId ?? undefined,
  projectId: row.projectId ?? undefined,
  type: row.type,
  title: row.title,
  body: row.body ?? undefined,
  occurredAt: row.occurredAt.toISOString(),
  actorType: row.actorType,
  actorUserId: row.actorUserId ?? undefined,
})

export const toEnumOption = (row: EnumOptionRow): EnumOption => ({
  id: row.id,
  kind: row.kind,
  value: row.value,
  label: row.label,
  color: row.color,
  position: row.position,
  semantic: row.semantic ?? undefined,
  defaultProbability: row.defaultProbability ?? undefined,
  archivedAt: row.archivedAt === null ? undefined : row.archivedAt.toISOString(),
})

export const toDoc = (row: DocRow): Doc => ({
  id: row.id,
  organizationId: row.organizationId,
  clientId: row.clientId,
  projectId: row.projectId ?? undefined,
  kind: row.kind,
  title: row.title,
  url: row.url ?? undefined,
  amountCzk: row.amountCzk ?? undefined,
  fileKey: row.fileKey ?? undefined,
  fileName: row.fileName ?? undefined,
  fileSize: row.fileSize ?? undefined,
  createdByUserId: row.createdByUserId ?? undefined,
})
