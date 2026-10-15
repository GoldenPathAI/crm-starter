import { and, asc, eq, isNull } from "drizzle-orm"
import { cache } from "react"
import type { EnumKind, EnumOption } from "@/core/types/crm.types"
import { toEnumOption } from "@/lib/crm/store/mappers"
import { db } from "@/lib/db/client"
import { enumOptions } from "@/lib/db/schema/crm"

export type OrgEnums = Record<EnumKind, EnumOption[]>

const emptyOrgEnums = (): OrgEnums => ({
  deal_stage: [],
  client_status: [],
  service_kind: [],
  project_status: [],
  ticket_status: [],
  ticket_priority: [],
  doc_kind: [],
  activity_type: [],
  person_kind: [],
  rapport_entry_kind: [],
})

export async function loadOrgEnumsUncached(orgId: string): Promise<OrgEnums> {
  const rows = await db
    .select()
    .from(enumOptions)
    .where(and(eq(enumOptions.organizationId, orgId), isNull(enumOptions.archivedAt)))
    .orderBy(asc(enumOptions.kind), asc(enumOptions.position))

  return rows.reduce<OrgEnums>((acc, row) => {
    const option = toEnumOption(row)
    // Rows of a kind the code no longer knows (e.g. dropped ciselniky awaiting their
    // cleanup migration) must not crash the whole enum load.
    if (acc[option.kind] === undefined) {
      return acc
    }

    return { ...acc, [option.kind]: [...acc[option.kind], option] }
  }, emptyOrgEnums())
}

export const loadOrgEnums = cache(loadOrgEnumsUncached)

export async function listOptions(orgId: string, kind: EnumKind): Promise<EnumOption[]> {
  const enums = await loadOrgEnums(orgId)

  return enums[kind]
}

export async function getBySemantic(
  orgId: string,
  kind: EnumKind,
  semantic: string,
): Promise<EnumOption> {
  const options = await listOptions(orgId, kind)
  const found = options.find((option) => option.semantic === semantic)
  if (found === undefined) {
    throw new Error(`Chybí povinná hodnota číselníku ${kind}/${semantic} pro organizaci ${orgId}.`)
  }

  return found
}

export async function assertValidValue(orgId: string, kind: EnumKind, value: string): Promise<void> {
  const options = await listOptions(orgId, kind)
  if (!options.some((option) => option.value === value)) {
    throw new Error(`Neplatná hodnota ${value} pro číselník ${kind}.`)
  }
}
