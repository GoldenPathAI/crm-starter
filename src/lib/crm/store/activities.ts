import { and, eq, sql } from "drizzle-orm"
import { resolveDbc, withTx } from "@/lib/crm/store/db"
import { activities, clients } from "@/lib/db/schema/crm"
import { toActivity } from "@/lib/crm/store/mappers"
import { loadOrgEnums } from "@/lib/crm/enums/service"
import { createId } from "@/lib/ids"
import type { Activity, ActivityType, Actor, OrgScope } from "@/core/types/crm.types"

// Semantics of the activity_type ciselnik a user can log by hand. Only these,
// authored by a real user, can be edited or removed later. System entries (stage
// changes, project created) and imported e-mails carry other semantics and stay
// immutable so the audit trail can never be rewritten.
const LOGGABLE_SEMANTICS: ReadonlySet<string> = new Set(["note", "call", "meeting"])

async function loggableTypeValues(orgId: string): Promise<ReadonlySet<string>> {
  const enums = await loadOrgEnums(orgId)
  return new Set(
    enums.activity_type
      .filter((option) => option.semantic !== undefined && LOGGABLE_SEMANTICS.has(option.semantic))
      .map((option) => option.value),
  )
}

const actorColumns = (
  actor: Actor,
): { actorType: Activity["actorType"]; actorUserId: string | null } =>
  actor.type === "user"
    ? { actorType: "user", actorUserId: actor.userId }
    : { actorType: actor.type, actorUserId: null }

export interface AddActivityInput {
  clientId: string
  type: ActivityType
  title: string
  body?: string
  dealId?: string
  projectId?: string
  // When the activity records something scheduled (e.g. a booked meeting), the caller
  // pins the timeline moment; otherwise it defaults to now.
  occurredAt?: Date
}

export async function addActivity(scope: OrgScope, input: AddActivityInput): Promise<Activity> {
  const loggable = await loggableTypeValues(scope.orgId)
  if (!loggable.has(input.type)) {
    throw new Error("Tento typ aktivity nelze zaznamenat.")
  }
  const dbc = resolveDbc(scope)
  const clientRows = await dbc
    .select({ id: clients.id })
    .from(clients)
    .where(and(eq(clients.id, input.clientId), eq(clients.organizationId, scope.orgId)))
    .limit(1)
  if (clientRows[0] === undefined) {
    throw new Error("Klient nebyl nalezen.")
  }

  const actor = actorColumns(scope.actor)
  const rows = await dbc
    .insert(activities)
    .values({
      id: createId("ac"),
      clientId: input.clientId,
      dealId: input.dealId ?? null,
      projectId: input.projectId ?? null,
      organizationId: scope.orgId,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      occurredAt: input.occurredAt ?? new Date(),
      actorType: actor.actorType,
      actorUserId: actor.actorUserId,
    })
    .returning()
  const row = rows[0]
  if (row === undefined) {
    throw new Error("Aktivitu se nepodařilo uložit.")
  }
  return toActivity(row)
}

export interface RecordEmailActivityInput {
  clientId: string
  type: ActivityType
  title: string
  body?: string
  externalId: string
  occurredAt?: Date
}

// Logs a sent or received email onto the client timeline. Unlike addActivity this
// bypasses the loggable-type guard (email types are not user-authored) and stamps the
// RFC Message-ID so the same message is never recorded twice. The caller resolves the
// email activity type value per org from its enum service.
export async function recordEmailActivity(
  scope: OrgScope,
  input: RecordEmailActivityInput,
): Promise<Activity> {
  const dbc = resolveDbc(scope)
  const clientRows = await dbc
    .select({ id: clients.id })
    .from(clients)
    .where(and(eq(clients.id, input.clientId), eq(clients.organizationId, scope.orgId)))
    .limit(1)
  if (clientRows[0] === undefined) {
    throw new Error("Klient nebyl nalezen.")
  }

  const actor = actorColumns(scope.actor)
  const rows = await dbc
    .insert(activities)
    .values({
      id: createId("ac"),
      clientId: input.clientId,
      dealId: null,
      projectId: null,
      organizationId: scope.orgId,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      occurredAt: input.occurredAt ?? new Date(),
      actorType: actor.actorType,
      actorUserId: actor.actorUserId,
      externalId: input.externalId,
    })
    .returning()
  const row = rows[0]
  if (row === undefined) {
    throw new Error("Aktivitu se nepodařilo uložit.")
  }
  return toActivity(row)
}

export interface SyncedEmailActivityInput {
  clientId: string
  type: ActivityType
  title: string
  body?: string
  externalId: string
  occurredAt: Date
}

// Inserts a message discovered by a background mailbox sync onto a client's timeline,
// deduped on the (org, external id) partial unique index. Returns true when a new row
// was written, false when the message was already logged (by an earlier sync or by a
// CRM send), so the caller counts inserts without racing the index. The clientId comes
// from the org's own client set, so no per-message existence check is done.
export async function insertSyncedEmailActivity(
  scope: OrgScope,
  input: SyncedEmailActivityInput,
): Promise<boolean> {
  const dbc = resolveDbc(scope)
  const actor = actorColumns(scope.actor)
  const rows = await dbc
    .insert(activities)
    .values({
      id: createId("ac"),
      clientId: input.clientId,
      dealId: null,
      projectId: null,
      organizationId: scope.orgId,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      occurredAt: input.occurredAt,
      actorType: actor.actorType,
      actorUserId: actor.actorUserId,
      externalId: input.externalId,
    })
    .onConflictDoNothing({
      target: [activities.organizationId, activities.externalId],
      where: sql`${activities.externalId} IS NOT NULL`,
    })
    .returning({ id: activities.id })
  return rows.length > 0
}

export async function getActivityById(scope: OrgScope, id: string): Promise<Activity | undefined> {
  const dbc = resolveDbc(scope)
  const rows = await dbc
    .select()
    .from(activities)
    .where(and(eq(activities.id, id), eq(activities.organizationId, scope.orgId)))
    .limit(1)
  const row = rows[0]
  return row === undefined ? undefined : toActivity(row)
}

export interface UpdateActivityInput {
  title: string
  body?: string
}

export async function updateActivity(
  scope: OrgScope,
  id: string,
  input: UpdateActivityInput,
): Promise<Activity> {
  const loggable = await loggableTypeValues(scope.orgId)
  const dbc = resolveDbc(scope)
  return withTx(dbc, async (tx) => {
    const existing = await tx
      .select()
      .from(activities)
      .where(and(eq(activities.id, id), eq(activities.organizationId, scope.orgId)))
      .limit(1)
    const current = existing[0]
    if (current === undefined) {
      throw new Error("Aktivita nebyla nalezena.")
    }
    if (current.actorType !== "user" || !loggable.has(current.type)) {
      throw new Error("Tuto aktivitu nelze upravit.")
    }
    const rows = await tx
      .update(activities)
      .set({ title: input.title, body: input.body ?? null })
      .where(and(eq(activities.id, id), eq(activities.organizationId, scope.orgId)))
      .returning()
    const row = rows[0]
    if (row === undefined) {
      throw new Error("Aktivita nebyla nalezena.")
    }
    return toActivity(row)
  })
}

// Moves an activity onto another client's timeline. Unlike updateActivity this is not
// an edit of the record itself (title, body and occurredAt stay untouched), so it is
// allowed for any type and actor: its purpose is fixing misattribution, typically a
// synced e-mail matched to the wrong client through a bad contact address. Activities
// pinned to a deal or project stay put, those links belong to the original client.
export async function reassignActivityClient(
  scope: OrgScope,
  id: string,
  clientId: string,
): Promise<Activity> {
  const dbc = resolveDbc(scope)
  return withTx(dbc, async (tx) => {
    const existing = await tx
      .select()
      .from(activities)
      .where(and(eq(activities.id, id), eq(activities.organizationId, scope.orgId)))
      .limit(1)
    const current = existing[0]
    if (current === undefined) {
      throw new Error("Aktivita nebyla nalezena.")
    }
    if (current.dealId !== null || current.projectId !== null) {
      throw new Error("Aktivitu navázanou na deal nebo projekt nelze přesunout.")
    }
    const target = await tx
      .select({ id: clients.id })
      .from(clients)
      .where(and(eq(clients.id, clientId), eq(clients.organizationId, scope.orgId)))
      .limit(1)
    if (target[0] === undefined) {
      throw new Error("Cílový klient nebyl nalezen.")
    }
    const rows = await tx
      .update(activities)
      .set({ clientId })
      .where(and(eq(activities.id, id), eq(activities.organizationId, scope.orgId)))
      .returning()
    const row = rows[0]
    if (row === undefined) {
      throw new Error("Aktivita nebyla nalezena.")
    }
    return toActivity(row)
  })
}

export async function deleteActivity(scope: OrgScope, id: string): Promise<void> {
  const loggable = await loggableTypeValues(scope.orgId)
  const dbc = resolveDbc(scope)
  await withTx(dbc, async (tx) => {
    const existing = await tx
      .select()
      .from(activities)
      .where(and(eq(activities.id, id), eq(activities.organizationId, scope.orgId)))
      .limit(1)
    const current = existing[0]
    if (current === undefined) {
      throw new Error("Aktivita nebyla nalezena.")
    }
    if (current.actorType !== "user" || !loggable.has(current.type)) {
      throw new Error("Tuto aktivitu nelze smazat.")
    }
    await tx
      .delete(activities)
      .where(and(eq(activities.id, id), eq(activities.organizationId, scope.orgId)))
  })
}
