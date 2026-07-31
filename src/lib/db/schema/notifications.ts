import { index, text, timestamp } from "drizzle-orm/pg-core"
import { organizations } from "./org"
import { crmSchema } from "./schema"

// In-app notification center. One row per delivered notification, per recipient user.
// user_id is not FK-constrained on purpose: it mirrors the app's other per-user tables
// and a notification outlives membership changes. entity_type/entity_id point the bell
// click at the target row (ticket, deal, client, project).
export const notifications = crmSchema.table(
  "notifications",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    type: text("type").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    entityType: text("entity_type"),
    entityId: text("entity_id"),
    readAt: timestamp("read_at", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("notifications_org_user_read_created_idx").on(
      table.organizationId,
      table.userId,
      table.readAt,
      table.createdAt.desc(),
    ),
  ],
)
