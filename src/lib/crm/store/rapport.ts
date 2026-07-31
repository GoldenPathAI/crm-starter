import { and, desc, eq } from "drizzle-orm"
import { getBySemantic } from "@/lib/crm/enums/service"
import { resolveDbc } from "@/lib/crm/store/db"
import { toRapportEntry } from "@/lib/crm/store/mappers"
import { people, rapportEntries } from "@/lib/db/schema/crm"
import { createId } from "@/lib/ids"
import type { OrgScope, RapportEntry } from "@/core/types/crm.types"

const actorUserId = (scope: OrgScope): string | null =>
  scope.actor.type === "user" ? scope.actor.userId : null

export interface CreateRapportEntryInput {
  personId: string
  content: string
  kind?: string
  happenedAt?: string
}

export async function listRapportEntries(
  scope: OrgScope,
  personId: string,
): Promise<RapportEntry[]> {
  const dbc = resolveDbc(scope)
  const rows = await dbc
    .select()
    .from(rapportEntries)
    .where(
      and(eq(rapportEntries.personId, personId), eq(rapportEntries.organizationId, scope.orgId)),
    )
    .orderBy(desc(rapportEntries.createdAt))
  return rows.map(toRapportEntry)
}

export async function createRapportEntry(
  scope: OrgScope,
  input: CreateRapportEntryInput,
): Promise<RapportEntry> {
  const content = input.content.trim()
  if (content.length === 0) {
    throw new Error("Záznam raportu nesmí být prázdný.")
  }
  const kind: string =
    input.kind ??
    (await getBySemantic(scope.orgId, "rapport_entry_kind", "fact").then((option) => option.value))

  const dbc = resolveDbc(scope)
  const person = await dbc
    .select({ id: people.id })
    .from(people)
    .where(and(eq(people.id, input.personId), eq(people.organizationId, scope.orgId)))
    .limit(1)
  if (person[0] === undefined) {
    throw new Error("Kontakt nebyl nalezen.")
  }

  const rows = await dbc
    .insert(rapportEntries)
    .values({
      id: createId("rp"),
      organizationId: scope.orgId,
      personId: input.personId,
      kind,
      content,
      happenedAt: input.happenedAt ?? null,
      createdByUserId: actorUserId(scope),
    })
    .returning()
  const row = rows[0]
  if (row === undefined) {
    throw new Error("Záznam raportu se nepodařilo uložit.")
  }
  return toRapportEntry(row)
}

export async function deleteRapportEntry(scope: OrgScope, entryId: string): Promise<void> {
  const dbc = resolveDbc(scope)
  const rows = await dbc
    .delete(rapportEntries)
    .where(and(eq(rapportEntries.id, entryId), eq(rapportEntries.organizationId, scope.orgId)))
    .returning({ id: rapportEntries.id })
  if (rows[0] === undefined) {
    throw new Error("Záznam raportu nebyl nalezen.")
  }
}
