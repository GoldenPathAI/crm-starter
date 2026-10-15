import { boolean, index, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core"
import { clients } from "./crm"
import { organizations } from "./org"
import { crmSchema } from "./schema"

// Command palette "Nedávné". One row per (user, item_type, entity) via the unique key;
// a re-visit upserts visited_at. user_id is not FK-constrained on purpose (mirrors
// notifications). entity_id has no FK: it is heterogeneous (client/deal/project/ticket)
// and item_type is validated in code, not a DB enum.
export const userRecentItems = crmSchema.table(
  "user_recent_items",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    itemType: text("item_type").notNull(),
    entityId: text("entity_id").notNull(),
    title: text("title").notNull(),
    href: text("href").notNull(),
    visitedAt: timestamp("visited_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("user_recent_items_org_user_type_entity_key").on(
      table.organizationId,
      table.userId,
      table.itemType,
      table.entityId,
    ),
    index("user_recent_items_org_user_visited_idx").on(
      table.organizationId,
      table.userId,
      table.visitedAt.desc(),
    ),
  ],
)

// Command palette "Připnuté". client_id FK cascade auto-unpins on client delete. The
// title is not stored: it is read live via a join to crm.clients.name so a rename shows.
export const userPinnedClients = crmSchema.table(
  "user_pinned_clients",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    clientId: text("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    href: text("href").notNull(),
    pinnedAt: timestamp("pinned_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("user_pinned_clients_org_user_client_key").on(
      table.organizationId,
      table.userId,
      table.clientId,
    ),
    index("user_pinned_clients_org_user_pinned_idx").on(
      table.organizationId,
      table.userId,
      table.pinnedAt.desc(),
    ),
  ],
)

// Browser saved views, scoped per list page (page_key). Saving under an existing name
// replaces it via the unique (org, user, page_key, name) key.
export const userSavedViews = crmSchema.table(
  "user_saved_views",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    pageKey: text("page_key").notNull(),
    name: text("name").notNull(),
    query: text("query").notNull(),
    // At most one default per (org, user, page), enforced by a partial unique index
    // in migration 0046; the default view is auto-applied on a bare page URL.
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("user_saved_views_org_user_page_name_key").on(
      table.organizationId,
      table.userId,
      table.pageKey,
      table.name,
    ),
    index("user_saved_views_org_user_page_created_idx").on(
      table.organizationId,
      table.userId,
      table.pageKey,
      table.createdAt.desc(),
    ),
  ],
)
