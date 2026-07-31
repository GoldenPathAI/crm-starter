-- Initial schema for the CRM starter. Applied by pnpm db:migrate (src/scripts/migrate.ts),
-- which creates schema crm and tracks applied files in crm._migrations. Every later change
-- is a new numbered file in this folder, hand written and idempotent.

CREATE TABLE "crm"."audit_log" (
	"id" text PRIMARY KEY NOT NULL DEFAULT gen_random_uuid()::text,
	"organization_id" text,
	"table_name" text NOT NULL,
	"row_id" text NOT NULL,
	"operation" text NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"actor_type" text,
	"actor_user_id" text,
	"on_behalf_user_id" text,
	"source" text,
	"request_id" text,
	"undo_of" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm"."accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"password" text,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm"."sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"active_organization_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "crm"."users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "crm"."verifications" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm"."activities" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"client_id" text NOT NULL,
	"deal_id" text,
	"project_id" text,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"occurred_at" timestamp with time zone NOT NULL,
	"actor_type" text NOT NULL,
	"actor_user_id" text,
	"external_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm"."api_rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"window_started_at" timestamp with time zone NOT NULL,
	"count" integer NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm"."clients" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"ico" text,
	"dic" text,
	"website" text,
	"industry" text NOT NULL,
	"street" text,
	"city" text,
	"zip" text,
	"status" text NOT NULL,
	"services" text[] NOT NULL,
	"billing_email" text,
	"mrr_czk" integer,
	"next_step" text,
	"last_contact_at" date,
	"note" text,
	"labels" text[] DEFAULT '{}'::text[] NOT NULL,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm"."deal_assignees" (
	"id" text PRIMARY KEY NOT NULL,
	"deal_id" text NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm"."deals" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"client_id" text NOT NULL,
	"title" text NOT NULL,
	"stage" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"value_czk" integer NOT NULL,
	"probability" integer,
	"expected_close" date,
	"next_step" text,
	"description" text,
	"stage_changed_at" timestamp with time zone NOT NULL,
	"lost_reason" text,
	"offer_url" text,
	"offer_url_normalized" text,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm"."documents" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"client_id" text NOT NULL,
	"project_id" text,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"url" text,
	"amount_czk" integer,
	"file_key" text,
	"file_name" text,
	"file_size" integer,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm"."enum_options" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"kind" text NOT NULL,
	"value" text NOT NULL,
	"label" text NOT NULL,
	"color" text NOT NULL,
	"position" integer NOT NULL,
	"semantic" text,
	"default_probability" integer,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm"."organization_settings" (
	"organization_id" text PRIMARY KEY NOT NULL,
	"stale_deal_days" integer DEFAULT 21 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm"."people" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"client_id" text,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"role" text,
	"email" text,
	"phone" text,
	"note" text,
	"is_primary" boolean NOT NULL,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm"."projects" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"client_id" text NOT NULL,
	"deal_id" text,
	"name" text NOT NULL,
	"description" text,
	"status" text NOT NULL,
	"started_at" date,
	"due_at" date,
	"budget_czk" integer,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm"."rapport_entries" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"person_id" text NOT NULL,
	"kind" text NOT NULL,
	"content" text NOT NULL,
	"happened_at" date,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm"."ticket_assignees" (
	"id" text PRIMARY KEY NOT NULL,
	"ticket_id" text NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm"."tickets" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"client_id" text NOT NULL,
	"project_id" text,
	"deal_id" text,
	"parent_id" text,
	"title" text NOT NULL,
	"description" text,
	"status" text NOT NULL,
	"priority" text NOT NULL,
	"due_at" date,
	"position" integer NOT NULL,
	"labels" text[] NOT NULL,
	"recurrence" text,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"done_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "crm"."notifications" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"entity_type" text,
	"entity_id" text,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm"."organization_invitations" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"email" text NOT NULL,
	"role" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp with time zone,
	"inviter_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm"."organization_members" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm"."organizations" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"logo" text,
	"metadata" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	CONSTRAINT "organizations_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "crm"."user_pinned_clients" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"client_id" text NOT NULL,
	"href" text NOT NULL,
	"pinned_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm"."user_recent_items" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"item_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"title" text NOT NULL,
	"href" text NOT NULL,
	"visited_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "crm"."user_saved_views" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"page_key" text NOT NULL,
	"name" text NOT NULL,
	"query" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "crm"."accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "crm"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "crm"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."activities" ADD CONSTRAINT "activities_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "crm"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."activities" ADD CONSTRAINT "activities_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "crm"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."activities" ADD CONSTRAINT "activities_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "crm"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."clients" ADD CONSTRAINT "clients_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "crm"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."clients" ADD CONSTRAINT "clients_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "crm"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."deal_assignees" ADD CONSTRAINT "deal_assignees_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "crm"."deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."deal_assignees" ADD CONSTRAINT "deal_assignees_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "crm"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."deals" ADD CONSTRAINT "deals_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "crm"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."deals" ADD CONSTRAINT "deals_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "crm"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."deals" ADD CONSTRAINT "deals_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "crm"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."documents" ADD CONSTRAINT "documents_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "crm"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."documents" ADD CONSTRAINT "documents_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "crm"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."documents" ADD CONSTRAINT "documents_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "crm"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."enum_options" ADD CONSTRAINT "enum_options_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "crm"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."organization_settings" ADD CONSTRAINT "organization_settings_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "crm"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."people" ADD CONSTRAINT "people_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "crm"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."people" ADD CONSTRAINT "people_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "crm"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."people" ADD CONSTRAINT "people_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "crm"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."projects" ADD CONSTRAINT "projects_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "crm"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."projects" ADD CONSTRAINT "projects_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "crm"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."projects" ADD CONSTRAINT "projects_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "crm"."deals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."projects" ADD CONSTRAINT "projects_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "crm"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."rapport_entries" ADD CONSTRAINT "rapport_entries_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "crm"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."rapport_entries" ADD CONSTRAINT "rapport_entries_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "crm"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."rapport_entries" ADD CONSTRAINT "rapport_entries_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "crm"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."ticket_assignees" ADD CONSTRAINT "ticket_assignees_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "crm"."tickets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."ticket_assignees" ADD CONSTRAINT "ticket_assignees_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "crm"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."tickets" ADD CONSTRAINT "tickets_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "crm"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."tickets" ADD CONSTRAINT "tickets_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "crm"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."tickets" ADD CONSTRAINT "tickets_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "crm"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."tickets" ADD CONSTRAINT "tickets_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "crm"."deals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."tickets" ADD CONSTRAINT "tickets_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "crm"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."notifications" ADD CONSTRAINT "notifications_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "crm"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."organization_invitations" ADD CONSTRAINT "organization_invitations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "crm"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."organization_invitations" ADD CONSTRAINT "organization_invitations_inviter_id_users_id_fk" FOREIGN KEY ("inviter_id") REFERENCES "crm"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."organization_members" ADD CONSTRAINT "organization_members_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "crm"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."organization_members" ADD CONSTRAINT "organization_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "crm"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."user_pinned_clients" ADD CONSTRAINT "user_pinned_clients_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "crm"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."user_pinned_clients" ADD CONSTRAINT "user_pinned_clients_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "crm"."clients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."user_recent_items" ADD CONSTRAINT "user_recent_items_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "crm"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm"."user_saved_views" ADD CONSTRAINT "user_saved_views_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "crm"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_log_org_created_idx" ON "crm"."audit_log" USING btree ("organization_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "audit_log_request_idx" ON "crm"."audit_log" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "audit_log_table_row_created_idx" ON "crm"."audit_log" USING btree ("table_name","row_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "accounts_user_id_idx" ON "crm"."accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "crm"."sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verifications_identifier_idx" ON "crm"."verifications" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "activities_client_occurred_idx" ON "crm"."activities" USING btree ("client_id","occurred_at");--> statement-breakpoint
CREATE INDEX "activities_org_occurred_idx" ON "crm"."activities" USING btree ("organization_id","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "activities_org_external_id_uk" ON "crm"."activities" USING btree ("organization_id","external_id") WHERE "crm"."activities"."external_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "api_rate_limits_updated_idx" ON "crm"."api_rate_limits" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "clients_status_idx" ON "crm"."clients" USING btree ("status");--> statement-breakpoint
CREATE INDEX "clients_org_status_idx" ON "crm"."clients" USING btree ("organization_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "deal_assignees_deal_user_uk" ON "crm"."deal_assignees" USING btree ("deal_id","user_id");--> statement-breakpoint
CREATE INDEX "deals_stage_idx" ON "crm"."deals" USING btree ("stage");--> statement-breakpoint
CREATE INDEX "deals_org_stage_idx" ON "crm"."deals" USING btree ("organization_id","stage");--> statement-breakpoint
CREATE INDEX "deals_offer_url_normalized_idx" ON "crm"."deals" USING btree ("offer_url_normalized");--> statement-breakpoint
CREATE INDEX "documents_client_idx" ON "crm"."documents" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "documents_org_idx" ON "crm"."documents" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "enum_options_org_kind_value_uk" ON "crm"."enum_options" USING btree ("organization_id","kind","value");--> statement-breakpoint
CREATE INDEX "enum_options_org_kind_position_idx" ON "crm"."enum_options" USING btree ("organization_id","kind","position");--> statement-breakpoint
CREATE INDEX "people_org_idx" ON "crm"."people" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "people_org_kind_idx" ON "crm"."people" USING btree ("organization_id","kind");--> statement-breakpoint
CREATE INDEX "projects_org_idx" ON "crm"."projects" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "rapport_entries_org_person_idx" ON "crm"."rapport_entries" USING btree ("organization_id","person_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "ticket_assignees_ticket_user_uk" ON "crm"."ticket_assignees" USING btree ("ticket_id","user_id");--> statement-breakpoint
CREATE INDEX "tickets_status_idx" ON "crm"."tickets" USING btree ("status");--> statement-breakpoint
CREATE INDEX "tickets_due_at_idx" ON "crm"."tickets" USING btree ("due_at");--> statement-breakpoint
CREATE INDEX "tickets_deal_idx" ON "crm"."tickets" USING btree ("deal_id");--> statement-breakpoint
CREATE INDEX "tickets_org_status_idx" ON "crm"."tickets" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "tickets_org_due_at_idx" ON "crm"."tickets" USING btree ("organization_id","due_at");--> statement-breakpoint
CREATE INDEX "notifications_org_user_read_created_idx" ON "crm"."notifications" USING btree ("organization_id","user_id","read_at","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "organization_members_org_user_uk" ON "crm"."organization_members" USING btree ("organization_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_pinned_clients_org_user_client_key" ON "crm"."user_pinned_clients" USING btree ("organization_id","user_id","client_id");--> statement-breakpoint
CREATE INDEX "user_pinned_clients_org_user_pinned_idx" ON "crm"."user_pinned_clients" USING btree ("organization_id","user_id","pinned_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "user_recent_items_org_user_type_entity_key" ON "crm"."user_recent_items" USING btree ("organization_id","user_id","item_type","entity_id");--> statement-breakpoint
CREATE INDEX "user_recent_items_org_user_visited_idx" ON "crm"."user_recent_items" USING btree ("organization_id","user_id","visited_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "user_saved_views_org_user_page_name_key" ON "crm"."user_saved_views" USING btree ("organization_id","user_id","page_key","name");--> statement-breakpoint
CREATE INDEX "user_saved_views_org_user_page_created_idx" ON "crm"."user_saved_views" USING btree ("organization_id","user_id","page_key","created_at" DESC NULLS LAST);