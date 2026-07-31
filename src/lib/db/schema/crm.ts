import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { users } from "./auth";
import { organizations } from "./org";
import { crmSchema } from "./schema";
import type {
  ActivityType,
  ClientStatus,
  ColorToken,
  DealStage,
  DocKind,
  EnumKind,
  PersonKind,
  ProjectStatus,
  RapportEntryKind,
  ServiceKind,
  TicketPriority,
  TicketRecurrence,
  TicketStatus,
} from "@/core/types/crm.types";

export { crmSchema };

export const clients = crmSchema.table(
  "clients",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    ico: text("ico"),
    dic: text("dic"),
    website: text("website"),
    industry: text("industry").notNull(),
    street: text("street"),
    city: text("city"),
    zip: text("zip"),
    status: text("status").$type<ClientStatus>().notNull(),
    services: text("services").array().$type<ServiceKind[]>().notNull(),
    billingEmail: text("billing_email"),
    mrrCzk: integer("mrr_czk"),
    nextStep: text("next_step"),
    lastContactAt: date("last_contact_at", { mode: "string" }),
    note: text("note"),
    labels: text("labels")
      .array()
      .$type<string[]>()
      .notNull()
      .default(sql`'{}'::text[]`),
    createdByUserId: text("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("clients_status_idx").on(table.status),
    index("clients_org_status_idx").on(table.organizationId, table.status),
  ],
);

// A contact and a rapport subject are the same person, so this table carries both:
// `client_id` is optional because rapport starts before (and outside) any business
// relationship, and the rapport fields (kind, profile note, next-touch tickler) sit
// on the same row. Attaching a client turns the row into that client's contact.
export const people = crmSchema.table(
  "people",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    clientId: text("client_id").references(() => clients.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    kind: text("kind").$type<PersonKind>().notNull(),
    role: text("role"),
    email: text("email"),
    phone: text("phone"),
    note: text("note"),
    isPrimary: boolean("is_primary").notNull(),
    createdByUserId: text("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("people_org_idx").on(table.organizationId),
    index("people_org_kind_idx").on(table.organizationId, table.kind),
  ],
);

// One rapport entry = one thing worth remembering about a person: a personal fact,
// a meeting takeaway or a plain note.
export const rapportEntries = crmSchema.table(
  "rapport_entries",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    personId: text("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),
    kind: text("kind").$type<RapportEntryKind>().notNull(),
    content: text("content").notNull(),
    happenedAt: date("happened_at", { mode: "string" }),
    createdByUserId: text("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("rapport_entries_org_person_idx").on(
      table.organizationId,
      table.personId,
      table.createdAt,
    ),
  ],
);

export const deals = crmSchema.table(
  "deals",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    clientId: text("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    stage: text("stage").$type<DealStage>().notNull(),
    order: integer("position").notNull().default(0),
    valueCzk: integer("value_czk").notNull(),
    probability: integer("probability"),
    expectedClose: date("expected_close", { mode: "string" }),
    nextStep: text("next_step"),
    description: text("description"),
    stageChangedAt: timestamp("stage_changed_at", { withTimezone: true, mode: "date" }).notNull(),
    lostReason: text("lost_reason"),
    offerUrl: text("offer_url"),
    offerUrlNormalized: text("offer_url_normalized"),
    createdByUserId: text("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("deals_stage_idx").on(table.stage),
    index("deals_org_stage_idx").on(table.organizationId, table.stage),
    index("deals_offer_url_normalized_idx").on(table.offerUrlNormalized),
  ],
);

export const projects = crmSchema.table(
  "projects",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    clientId: text("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    dealId: text("deal_id").references(() => deals.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    description: text("description"),
    status: text("status").$type<ProjectStatus>().notNull(),
    startedAt: date("started_at", { mode: "string" }),
    dueAt: date("due_at", { mode: "string" }),
    budgetCzk: integer("budget_czk"),
    createdByUserId: text("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [index("projects_org_idx").on(table.organizationId)],
);

export const tickets = crmSchema.table(
  "tickets",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    clientId: text("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    projectId: text("project_id").references(() => projects.id, { onDelete: "cascade" }),
    dealId: text("deal_id").references(() => deals.id, { onDelete: "set null" }),
    parentId: text("parent_id"),
    title: text("title").notNull(),
    description: text("description"),
    status: text("status").$type<TicketStatus>().notNull(),
    priority: text("priority").$type<TicketPriority>().notNull(),
    dueAt: date("due_at", { mode: "string" }),
    order: integer("position").notNull(),
    labels: text("labels").array().$type<string[]>().notNull(),
    recurrence: text("recurrence").$type<TicketRecurrence>(),
    createdByUserId: text("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    doneAt: timestamp("done_at", { withTimezone: true, mode: "date" }),
  },
  (table) => [
    index("tickets_status_idx").on(table.status),
    index("tickets_due_at_idx").on(table.dueAt),
    index("tickets_deal_idx").on(table.dealId),
    index("tickets_org_status_idx").on(table.organizationId, table.status),
    index("tickets_org_due_at_idx").on(table.organizationId, table.dueAt),
  ],
);

export const activities = crmSchema.table(
  "activities",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    clientId: text("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    dealId: text("deal_id"),
    projectId: text("project_id"),
    type: text("type").$type<ActivityType>().notNull(),
    title: text("title").notNull(),
    body: text("body"),
    occurredAt: timestamp("occurred_at", { withTimezone: true, mode: "date" }).notNull(),
    actorType: text("actor_type").$type<"user" | "ai" | "system">().notNull(),
    actorUserId: text("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    // Stable id of the source record when the activity was imported from an external
    // system (mail, calendar, telephony). Unique per org so an import never duplicates.
    externalId: text("external_id"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("activities_client_occurred_idx").on(table.clientId, table.occurredAt),
    index("activities_org_occurred_idx").on(table.organizationId, table.occurredAt),
    uniqueIndex("activities_org_external_id_uk")
      .on(table.organizationId, table.externalId)
      .where(sql`${table.externalId} IS NOT NULL`),
  ],
);

export const apiRateLimits = crmSchema.table(
  "api_rate_limits",
  {
    key: text("key").primaryKey(),
    windowStartedAt: timestamp("window_started_at", { withTimezone: true, mode: "date" }).notNull(),
    count: integer("count").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull(),
  },
  (table) => [index("api_rate_limits_updated_idx").on(table.updatedAt)],
);

export const documents = crmSchema.table(
  "documents",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    clientId: text("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    projectId: text("project_id"),
    kind: text("kind").$type<DocKind>().notNull(),
    title: text("title").notNull(),
    url: text("url"),
    amountCzk: integer("amount_czk"),
    fileKey: text("file_key"),
    fileName: text("file_name"),
    fileSize: integer("file_size"),
    createdByUserId: text("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("documents_client_idx").on(table.clientId),
    index("documents_org_idx").on(table.organizationId),
  ],
);
export const enumOptions = crmSchema.table(
  "enum_options",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    kind: text("kind").$type<EnumKind>().notNull(),
    value: text("value").notNull(),
    label: text("label").notNull(),
    color: text("color").$type<ColorToken>().notNull(),
    position: integer("position").notNull(),
    semantic: text("semantic"),
    defaultProbability: integer("default_probability"),
    archivedAt: timestamp("archived_at", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("enum_options_org_kind_value_uk").on(table.organizationId, table.kind, table.value),
    index("enum_options_org_kind_position_idx").on(
      table.organizationId,
      table.kind,
      table.position,
    ),
  ],
);
export const organizationSettings = crmSchema.table("organization_settings", {
  organizationId: text("organization_id")
    .primaryKey()
    .references(() => organizations.id, { onDelete: "cascade" }),
  staleDealDays: integer("stale_deal_days").notNull().default(21),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

export const ticketAssignees = crmSchema.table(
  "ticket_assignees",
  {
    id: text("id").primaryKey(),
    ticketId: text("ticket_id")
      .notNull()
      .references(() => tickets.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("ticket_assignees_ticket_user_uk").on(table.ticketId, table.userId)],
);

export const dealAssignees = crmSchema.table(
  "deal_assignees",
  {
    id: text("id").primaryKey(),
    dealId: text("deal_id")
      .notNull()
      .references(() => deals.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("deal_assignees_deal_user_uk").on(table.dealId, table.userId)],
);
