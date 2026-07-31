import type { CrmDbc } from "@/lib/db/client";

// Enum values are per-organization rows in crm.enum_options. The string aliases stay
// for readability, but the real contract is runtime validation against the org's
// options (assertValidValue) plus branching on option.semantic, never value literals.
export type ColorToken =
  "slate" | "blue" | "green" | "orange" | "red" | "purple" | "teal" | "indigo" | "cyan";

export type DealStage = string;
export type ClientStatus = string;
export type ServiceKind = string;
export type ProjectStatus = string;
export type TicketStatus = string;
export type TicketPriority = string;
export type DocKind = string;
export type ActivityType = string;
export type PersonKind = string;
export type RapportEntryKind = string;

// Ticket recurrence is an internal fixed discriminator, not an org-configurable
// ciselnik: completing a recurring ticket spawns the next occurrence with the due date
// advanced by this interval, so code branches on the value. Czech labels live in the UI.
export const TICKET_RECURRENCE_VALUES = ["weekly", "biweekly", "monthly", "quarterly"] as const;
export type TicketRecurrence = (typeof TICKET_RECURRENCE_VALUES)[number];
export const isTicketRecurrence = (value: string): value is TicketRecurrence =>
  (TICKET_RECURRENCE_VALUES as readonly string[]).includes(value);

export type EnumKind =
  | "deal_stage"
  | "client_status"
  | "service_kind"
  | "project_status"
  | "ticket_status"
  | "ticket_priority"
  | "doc_kind"
  | "activity_type"
  | "person_kind"
  | "rapport_entry_kind";

export interface EnumOption {
  id: string;
  kind: EnumKind;
  value: string;
  label: string;
  color: ColorToken;
  position: number;
  semantic?: string;
  defaultProbability?: number;
  archivedAt?: string;
}

export type Actor = { type: "user"; userId: string } | { type: "ai" } | { type: "system" };

export interface OrgScope {
  orgId: string;
  actor: Actor;
  // When present, every store call in this scope runs on this handle (an open
  // audited transaction) instead of the shared pool. Absent for ordinary calls.
  db?: CrmDbc;
}

export type OrgRole = "owner" | "admin" | "member";

export interface OrgMember {
  userId: string;
  name: string;
  email: string;
  role: OrgRole;
  joinedAt: string;
}

export interface OrgSettings {
  organizationId: string;
  // A deal sitting in one stage this long with no next step counts as stuck on the
  // dashboard. Per workspace so a slow sales cycle can raise its own bar.
  staleDealDays: number;
}

export interface Client {
  id: string;
  organizationId: string;
  name: string;
  ico?: string;
  dic?: string;
  website?: string;
  industry: string;
  street?: string;
  city?: string;
  zip?: string;
  status: ClientStatus;
  services: ServiceKind[];
  billingEmail?: string;
  mrrCzk?: number;
  nextStep?: string;
  lastContactAt?: string;
  note?: string;
  labels: string[];
  createdByUserId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Person {
  id: string;
  organizationId: string;
  // Absent while the person is only a rapport contact with no client behind them.
  clientId?: string;
  name: string;
  kind: PersonKind;
  role?: string;
  email?: string;
  phone?: string;
  note?: string;
  isPrimary: boolean;
  createdByUserId?: string;
  createdAt: string;
}

export interface RapportEntry {
  id: string;
  organizationId: string;
  personId: string;
  kind: RapportEntryKind;
  content: string;
  happenedAt?: string;
  createdByUserId?: string;
  createdAt: string;
}

export interface Deal {
  id: string;
  organizationId: string;
  clientId: string;
  title: string;
  stage: DealStage;
  order: number;
  valueCzk: number;
  probability?: number;
  expectedClose?: string;
  nextStep?: string;
  description?: string;
  stageChangedAt: string;
  lostReason?: string;
  offerUrl?: string;
  createdByUserId?: string;
  createdAt: string;
}

export interface Project {
  id: string;
  organizationId: string;
  clientId: string;
  dealId?: string;
  name: string;
  description?: string;
  status: ProjectStatus;
  startedAt?: string;
  dueAt?: string;
  budgetCzk?: number;
  createdByUserId?: string;
}

export interface Ticket {
  id: string;
  organizationId: string;
  clientId: string;
  projectId?: string;
  dealId?: string;
  parentId?: string;
  title: string;
  description?: string;
  status: TicketStatus;
  priority: TicketPriority;
  dueAt?: string;
  order: number;
  labels: string[];
  recurrence?: TicketRecurrence;
  createdByUserId?: string;
  createdAt: string;
  doneAt?: string;
}

export interface TicketWithAssignees extends Ticket {
  assignees: OrgMember[];
}

export interface Activity {
  id: string;
  organizationId: string;
  clientId: string;
  dealId?: string;
  projectId?: string;
  type: ActivityType;
  title: string;
  body?: string;
  occurredAt: string;
  actorType: "user" | "ai" | "system";
  actorUserId?: string;
  actorName?: string;
}

export interface Doc {
  id: string;
  organizationId: string;
  clientId: string;
  projectId?: string;
  kind: DocKind;
  title: string;
  url?: string;
  amountCzk?: number;
  fileKey?: string;
  fileName?: string;
  fileSize?: number;
  createdByUserId?: string;
}

// Notification center entity refs. The bell maps these to an in-app link; a value
// outside the union stays a plain non-clickable row.
export type NotificationEntityType = "ticket" | "deal" | "client" | "project";

export interface Notification {
  id: string;
  organizationId: string;
  userId: string;
  type: string;
  title: string;
  body?: string;
  entityType?: NotificationEntityType;
  entityId?: string;
  readAt?: string;
  createdAt: string;
}

export interface CrmDatabaseShape {
  clients: Client[];
  people: Person[];
  deals: Deal[];
  projects: Project[];
  tickets: Ticket[];
  activities: Activity[];
  documents: Doc[];
}
