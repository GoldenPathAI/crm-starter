import { index, jsonb, text, timestamp } from "drizzle-orm/pg-core"
import { crmSchema } from "./schema"

// Database-level audit trail. Rows are written by the crm.audit_row_change trigger,
// never by application code; the app only reads them (undo, history). organizationId
// is nullable because a handful of audited tables carry no organization_id column.
export const auditLog = crmSchema.table(
  "audit_log",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id"),
    tableName: text("table_name").notNull(),
    rowId: text("row_id").notNull(),
    operation: text("operation").$type<"INSERT" | "UPDATE" | "DELETE">().notNull(),
    before: jsonb("before").$type<Record<string, unknown>>(),
    after: jsonb("after").$type<Record<string, unknown>>(),
    actorType: text("actor_type").$type<"user" | "ai" | "system">(),
    actorUserId: text("actor_user_id"),
    onBehalfUserId: text("on_behalf_user_id"),
    source: text("source"),
    requestId: text("request_id"),
    undoOf: text("undo_of"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("audit_log_org_created_idx").on(table.organizationId, table.createdAt.desc()),
    index("audit_log_request_idx").on(table.requestId),
    index("audit_log_table_row_created_idx").on(table.tableName, table.rowId, table.createdAt.desc()),
  ],
)
