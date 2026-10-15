import { and, asc, desc, eq, ilike, inArray, or, sql, type SQL } from "drizzle-orm"
import { resolveDbc, withTx } from "@/lib/crm/store/db"
import { getBySemantic } from "@/lib/crm/enums/service"
import { clients, people, rapportEntries } from "@/lib/db/schema/crm"
import { createId } from "@/lib/ids"
import { toPerson } from "@/lib/crm/store/mappers"
import { SortDirection } from "@/core/types/query.types"
import type { RapportSortField } from "@/core/listFields"
import type { CrmDbc } from "@/lib/db/client"
import type { OrgScope, Person } from "@/core/types/crm.types"

const actorUserId = (scope: OrgScope): string | null =>
  scope.actor.type === "user" ? scope.actor.userId : null

export async function getPeopleByClientIds(
  scope: OrgScope,
  clientIds: string[],
): Promise<Person[]> {
  if (clientIds.length === 0) {
    return []
  }

  const dbc = resolveDbc(scope)
  const rows = await dbc
    .select()
    .from(people)
    .where(and(inArray(people.clientId, clientIds), eq(people.organizationId, scope.orgId)))
    .orderBy(asc(people.id))

  return rows.map(toPerson)
}

export interface PersonWithRapport extends Person {
  clientName?: string
  entryCount: number
  lastEntryAt?: string
}

export interface RapportPeopleQuery {
  kinds?: string[]
  q?: string
  // Rapport is a small list; the grid loads every matching person and buckets
  // client-side, so there is no pagination to thread through.
  sort?: { field: RapportSortField; direction: SortDirection }
}

const rapportSortColumn = (query: RapportPeopleQuery): SQL => {
  const direction = query.sort?.direction === SortDirection.Desc ? desc : asc
  switch (query.sort?.field) {
    case "createdAt":
      return direction(people.createdAt)
    case "lastEntryAt":
      return direction(LAST_ENTRY_AT)
    default:
      return direction(people.name)
  }
}

const LAST_ENTRY_AT = sql<Date | null>`max(${rapportEntries.createdAt})`

// Every person in the org with their rapport counters, for the raport grid.
export async function listRapportPeople(
  scope: OrgScope,
  query: RapportPeopleQuery = {},
): Promise<PersonWithRapport[]> {
  const conditions: SQL[] = [eq(people.organizationId, scope.orgId)]
  if (query.kinds !== undefined && query.kinds.length > 0) {
    conditions.push(inArray(people.kind, query.kinds))
  }

  if (query.q !== undefined && query.q.length > 0) {
    const needle = `%${query.q}%`
    const match = or(
      ilike(people.name, needle),
      ilike(people.role, needle),
      ilike(people.note, needle),
      ilike(clients.name, needle),
    )
    if (match !== undefined) {
      conditions.push(match)
    }
  }

  const dbc = resolveDbc(scope)
  const rows = await dbc
    .select({
      person: people,
      clientName: clients.name,
      entryCount: sql<number>`count(${rapportEntries.id})::int`,
      lastEntryAt: LAST_ENTRY_AT,
    })
    .from(people)
    .leftJoin(clients, eq(clients.id, people.clientId))
    .leftJoin(rapportEntries, eq(rapportEntries.personId, people.id))
    .where(and(...conditions))
    .groupBy(people.id, clients.name)
    .orderBy(rapportSortColumn(query), asc(people.name))

  return rows.map((row) => ({
    ...toPerson(row.person),
    clientName: row.clientName ?? undefined,
    entryCount: row.entryCount,
    lastEntryAt: row.lastEntryAt === null ? undefined : new Date(row.lastEntryAt).toISOString(),
  }))
}

export async function getPerson(scope: OrgScope, personId: string): Promise<Person> {
  const dbc = resolveDbc(scope)
  const rows = await dbc
    .select()
    .from(people)
    .where(and(eq(people.id, personId), eq(people.organizationId, scope.orgId)))
    .limit(1)
  const row = rows[0]
  if (row === undefined) {
    throw new Error("Kontakt nebyl nalezen.")
  }

  return toPerson(row)
}

export async function getPeopleByClientId(scope: OrgScope, clientId: string): Promise<Person[]> {
  const dbc = resolveDbc(scope)
  const rows = await dbc
    .select()
    .from(people)
    .where(and(eq(people.clientId, clientId), eq(people.organizationId, scope.orgId)))
    .orderBy(asc(people.id))

  return rows.map(toPerson)
}

// A person attached to a client is a klient-kind contact, a bare rapport person
// starts as a prospect. Both values come from the org ciselnik, never a literal.
export const defaultPersonKind = (orgId: string, hasClient: boolean): Promise<string> =>
  getBySemantic(orgId, "person_kind", hasClient ? "client" : "prospect").then(
    (option) => option.value,
  )

const findClient = async (
  dbc: CrmDbc,
  scope: OrgScope,
  clientId: string | undefined,
): Promise<{ id: string; name: string } | null> => {
  if (clientId === undefined) {
    return null
  }

  const rows = await dbc
    .select({ id: clients.id, name: clients.name })
    .from(clients)
    .where(and(eq(clients.id, clientId), eq(clients.organizationId, scope.orgId)))
    .limit(1)
  const client = rows[0]
  if (client === undefined) {
    throw new Error("Klient nebyl nalezen.")
  }

  return client
}

const countClientPeople = async (
  dbc: CrmDbc,
  scope: OrgScope,
  clientId: string,
): Promise<number> => {
  const rows = await dbc
    .select({ id: people.id })
    .from(people)
    .where(and(eq(people.clientId, clientId), eq(people.organizationId, scope.orgId)))

  return rows.length
}

export interface CreatePersonInput {
  // Absent for a rapport-only person: someone we build trust with before (or
  // without) any client record behind them.
  clientId?: string
  name: string
  kind?: string
  role?: string
  email?: string
  phone?: string
  note?: string
  isPrimary?: boolean
}

export interface UpdatePersonInput {
  name?: string
  kind?: string
  clientId?: string | null
  role?: string | null
  email?: string | null
  phone?: string | null
  note?: string | null
}

// A client keeps exactly one primary once it has any people. The first contact
// is always primary, an explicit isPrimary demotes the others. A person without a
// client is never primary.
export async function createPerson(scope: OrgScope, input: CreatePersonInput): Promise<Person> {
  const kind = input.kind ?? (await defaultPersonKind(scope.orgId, input.clientId !== undefined))
  const dbc = resolveDbc(scope)
  const created = await withTx(dbc, async (tx) => {
    const client = await findClient(tx, scope, input.clientId)

    const makePrimary =
      client !== null && (input.isPrimary === true || (await countClientPeople(tx, scope, client.id)) === 0)
    if (makePrimary && client !== null) {
      await tx
        .update(people)
        .set({ isPrimary: false })
        .where(and(eq(people.clientId, client.id), eq(people.organizationId, scope.orgId)))
    }

    const inserted = await tx
      .insert(people)
      .values({
        id: createId("pe"),
        organizationId: scope.orgId,
        clientId: client?.id ?? null,
        name: input.name,
        kind,
        role: input.role ?? null,
        email: input.email ?? null,
        phone: input.phone ?? null,
        note: input.note ?? null,
        isPrimary: makePrimary,
        createdByUserId: actorUserId(scope),
      })
      .returning()
    const row = inserted[0]
    if (row === undefined) {
      throw new Error("Kontakt se nepodařilo uložit.")
    }

    return { person: toPerson(row), company: client?.name ?? null }
  })

  return created.person
}

export async function updatePerson(
  scope: OrgScope,
  id: string,
  patch: UpdatePersonInput,
): Promise<Person> {
  const dbc = resolveDbc(scope)
  // Attaching a client is validated the same way as on create, so a patch can never
  // point a person at another workspace's client. findClient throws when it misses.
  if (patch.clientId !== undefined && patch.clientId !== null) {
    await findClient(dbc, scope, patch.clientId)
  }

  const setValues: Partial<typeof people.$inferInsert> = {
    ...(patch.name !== undefined ? { name: patch.name } : {}),
    ...(patch.kind !== undefined ? { kind: patch.kind } : {}),
    ...(patch.clientId !== undefined ? { clientId: patch.clientId } : {}),
    // A person detached from a client cannot stay that client's primary contact.
    ...(patch.clientId === null ? { isPrimary: false } : {}),
    ...(patch.role !== undefined ? { role: patch.role } : {}),
    ...(patch.email !== undefined ? { email: patch.email } : {}),
    ...(patch.phone !== undefined ? { phone: patch.phone } : {}),
    ...(patch.note !== undefined ? { note: patch.note } : {}),
    updatedAt: new Date(),
  }
  const rows = await dbc
    .update(people)
    .set(setValues)
    .where(and(eq(people.id, id), eq(people.organizationId, scope.orgId)))
    .returning()
  const row = rows[0]
  if (row === undefined) {
    throw new Error("Kontakt nebyl nalezen.")
  }

  return toPerson(row)
}

export async function setPrimaryPerson(scope: OrgScope, personId: string): Promise<Person> {
  const dbc = resolveDbc(scope)

  return withTx(dbc, async (tx) => {
    const found = await tx
      .select()
      .from(people)
      .where(and(eq(people.id, personId), eq(people.organizationId, scope.orgId)))
      .limit(1)
    const target = found[0]
    if (target === undefined) {
      throw new Error("Kontakt nebyl nalezen.")
    }

    if (target.clientId === null) {
      throw new Error("Osoba bez klienta nemůže být primárním kontaktem.")
    }

    await tx
      .update(people)
      .set({ isPrimary: false })
      .where(and(eq(people.clientId, target.clientId), eq(people.organizationId, scope.orgId)))
    const rows = await tx
      .update(people)
      .set({ isPrimary: true })
      .where(and(eq(people.id, personId), eq(people.organizationId, scope.orgId)))
      .returning()
    const row = rows[0]
    if (row === undefined) {
      throw new Error("Kontakt nebyl nalezen.")
    }

    return toPerson(row)
  })
}

// Removing the primary promotes the oldest remaining contact so the invariant
// (one primary while any people exist) holds.
export async function deletePerson(scope: OrgScope, personId: string): Promise<void> {
  const dbc = resolveDbc(scope)
  await withTx(dbc, async (tx) => {
    const found = await tx
      .select()
      .from(people)
      .where(and(eq(people.id, personId), eq(people.organizationId, scope.orgId)))
      .limit(1)
    const target = found[0]
    if (target === undefined) {
      throw new Error("Kontakt nebyl nalezen.")
    }

    await tx
      .delete(people)
      .where(and(eq(people.id, personId), eq(people.organizationId, scope.orgId)))
    if (target.isPrimary && target.clientId !== null) {
      const clientId = target.clientId
      const remaining = await tx
        .select({ id: people.id })
        .from(people)
        .where(and(eq(people.clientId, clientId), eq(people.organizationId, scope.orgId)))
        .orderBy(asc(people.createdAt), asc(people.id))
        .limit(1)
      const next = remaining[0]
      if (next !== undefined) {
        await tx
          .update(people)
          .set({ isPrimary: true })
          .where(and(eq(people.id, next.id), eq(people.organizationId, scope.orgId)))
      }
    }
  })
}
