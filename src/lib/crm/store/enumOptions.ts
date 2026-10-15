import { and, asc, count, eq, isNull, max } from "drizzle-orm"
import { REQUIRED_SEMANTICS } from "@/core/enumDefaults"
import type { ColorToken, EnumKind, EnumOption, OrgScope } from "@/core/types/crm.types"
import { toEnumOption } from "@/lib/crm/store/mappers"
import { db } from "@/lib/db/client"
import { resolveDbc, withTx } from "@/lib/crm/store/db"
import { enumOptions } from "@/lib/db/schema/crm"
import { createId } from "@/lib/ids"

const VALUE_PATTERN = /^[a-z][a-z0-9_]*$/

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "23505"
}

// Editor read: every option of a kind including archived ones, in position order.
// The enum service (loadOrgEnums) excludes archived rows, so the settings editor needs
// its own read to render and unarchive them.
export async function listAllOptions(orgId: string, kind: EnumKind): Promise<EnumOption[]> {
  const rows = await db
    .select()
    .from(enumOptions)
    .where(and(eq(enumOptions.organizationId, orgId), eq(enumOptions.kind, kind)))
    .orderBy(asc(enumOptions.position))

  return rows.map(toEnumOption)
}

export interface CreateEnumOptionInput {
  value: string
  label: string
  color: ColorToken
}

export async function createEnumOption(
  scope: OrgScope,
  kind: EnumKind,
  input: CreateEnumOptionInput,
): Promise<EnumOption> {
  if (!VALUE_PATTERN.test(input.value)) {
    throw new Error(
      "Hodnota smí obsahovat jen malá písmena, číslice a podtržítko a musí začínat písmenem.",
    )
  }

  const dbc = resolveDbc(scope)
  const maxRow = await dbc
    .select({ m: max(enumOptions.position) })
    .from(enumOptions)
    .where(and(eq(enumOptions.organizationId, scope.orgId), eq(enumOptions.kind, kind)))
  const nextPosition = (maxRow[0]?.m ?? -1) + 1

  try {
    const rows = await dbc
      .insert(enumOptions)
      .values({
        id: createId("eo"),
        organizationId: scope.orgId,
        kind,
        value: input.value,
        label: input.label,
        color: input.color,
        position: nextPosition,
      })
      .returning()
    const row = rows[0]
    if (row === undefined) {
      throw new Error("Hodnotu číselníku se nepodařilo vytvořit.")
    }

    return toEnumOption(row)
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new Error("Hodnota už v číselníku existuje.")
    }

    throw error
  }
}

export interface UpdateEnumOptionPatch {
  label?: string
  color?: ColorToken
  defaultProbability?: number | null
}

export async function updateEnumOption(
  scope: OrgScope,
  id: string,
  patch: UpdateEnumOptionPatch,
): Promise<EnumOption> {
  const dbc = resolveDbc(scope)
  const rows = await dbc
    .update(enumOptions)
    .set({
      updatedAt: new Date(),
      ...(patch.label !== undefined ? { label: patch.label } : {}),
      ...(patch.color !== undefined ? { color: patch.color } : {}),
      ...(patch.defaultProbability !== undefined ? { defaultProbability: patch.defaultProbability } : {}),
    })
    .where(and(eq(enumOptions.id, id), eq(enumOptions.organizationId, scope.orgId)))
    .returning()
  const row = rows[0]
  if (row === undefined) {
    throw new Error("Hodnota číselníku nebyla nalezena.")
  }

  return toEnumOption(row)
}

export async function reorderEnumOptions(
  scope: OrgScope,
  kind: EnumKind,
  orderedIds: string[],
): Promise<void> {
  const dbc = resolveDbc(scope)
  await withTx(dbc, async (tx) => {
    const active = await tx
      .select({ id: enumOptions.id })
      .from(enumOptions)
      .where(
        and(
          eq(enumOptions.organizationId, scope.orgId),
          eq(enumOptions.kind, kind),
          isNull(enumOptions.archivedAt),
        ),
      )
    const activeIds = new Set(active.map((row) => row.id))
    const orderedSet = new Set(orderedIds)
    const matches =
      orderedIds.length === activeIds.size &&
      orderedIds.every((id) => activeIds.has(id)) &&
      [...activeIds].every((id) => orderedSet.has(id))
    if (!matches) {
      throw new Error("Seznam pořadí neodpovídá aktivním hodnotám číselníku.")
    }

    for (const [position, id] of orderedIds.entries()) {
      await tx
        .update(enumOptions)
        .set({ position, updatedAt: new Date() })
        .where(and(eq(enumOptions.id, id), eq(enumOptions.organizationId, scope.orgId)))
    }
  })
}

export async function archiveEnumOption(scope: OrgScope, id: string): Promise<void> {
  const dbc = resolveDbc(scope)
  const rows = await dbc
    .select()
    .from(enumOptions)
    .where(and(eq(enumOptions.id, id), eq(enumOptions.organizationId, scope.orgId)))
    .limit(1)
  const row = rows[0]
  if (row === undefined) {
    throw new Error("Hodnota číselníku nebyla nalezena.")
  }

  const required = REQUIRED_SEMANTICS[row.kind]
  if (row.semantic !== null && required?.includes(row.semantic) === true) {
    throw new Error("Tuto hodnotu nelze archivovat, je vyžadována aplikací.")
  }

  const activeCount = await dbc
    .select({ c: count() })
    .from(enumOptions)
    .where(
      and(
        eq(enumOptions.organizationId, scope.orgId),
        eq(enumOptions.kind, row.kind),
        isNull(enumOptions.archivedAt),
      ),
    )
  if ((activeCount[0]?.c ?? 0) <= 1) {
    throw new Error("Nelze archivovat poslední aktivní hodnotu číselníku.")
  }

  await dbc
    .update(enumOptions)
    .set({ archivedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(enumOptions.id, id), eq(enumOptions.organizationId, scope.orgId)))
}

export async function unarchiveEnumOption(scope: OrgScope, id: string): Promise<void> {
  const dbc = resolveDbc(scope)
  const rows = await dbc
    .update(enumOptions)
    .set({ archivedAt: null, updatedAt: new Date() })
    .where(and(eq(enumOptions.id, id), eq(enumOptions.organizationId, scope.orgId)))
    .returning({ id: enumOptions.id })
  if (rows[0] === undefined) {
    throw new Error("Hodnota číselníku nebyla nalezena.")
  }
}
