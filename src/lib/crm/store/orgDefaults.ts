import { DEFAULT_ENUM_OPTIONS, DEFAULT_ORG_SETTINGS } from "@/core/enumDefaults"
import { ENUM_KINDS } from "@/core/types/crm.types"
import { db } from "@/lib/db/client"
import { enumOptions, organizationSettings } from "@/lib/db/schema/crm"
import { createId } from "@/lib/ids"

export async function seedOrganizationDefaults(organizationId: string): Promise<void> {
  const rows = ENUM_KINDS.flatMap((kind) =>
    DEFAULT_ENUM_OPTIONS[kind].map((option, index) => ({
      id: createId("eo"),
      organizationId,
      kind,
      value: option.value,
      label: option.label,
      color: option.color,
      position: index,
      semantic: option.semantic ?? null,
      defaultProbability: option.defaultProbability ?? null,
    })),
  )

  await db.transaction(async (tx) => {
    await tx
      .insert(enumOptions)
      .values(rows)
      .onConflictDoNothing({
        target: [enumOptions.organizationId, enumOptions.kind, enumOptions.value],
      })
    await tx
      .insert(organizationSettings)
      .values({ organizationId, staleDealDays: DEFAULT_ORG_SETTINGS.staleDealDays })
      .onConflictDoNothing({ target: organizationSettings.organizationId })
  })
}
