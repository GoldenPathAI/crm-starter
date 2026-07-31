import { eq } from "drizzle-orm"
import type { OrgScope, OrgSettings } from "@/core/types/crm.types"
import { db } from "@/lib/db/client"
import { resolveDbc } from "@/lib/crm/store/db"
import { organizationSettings } from "@/lib/db/schema/crm"

type SettingsRow = typeof organizationSettings.$inferSelect

const toOrgSettings = (row: SettingsRow): OrgSettings => ({
  organizationId: row.organizationId,
  staleDealDays: row.staleDealDays,
})

export async function getOrgSettings(orgId: string): Promise<OrgSettings> {
  const rows = await db
    .select()
    .from(organizationSettings)
    .where(eq(organizationSettings.organizationId, orgId))
    .limit(1)
  const row = rows[0]
  if (row === undefined) {
    throw new Error(`Nastavení organizace ${orgId} nebylo nalezeno.`)
  }
  return toOrgSettings(row)
}

export interface UpdateOrgSettingsPatch {
  staleDealDays?: number
}

export async function updateOrgSettings(
  scope: OrgScope,
  patch: UpdateOrgSettingsPatch,
): Promise<OrgSettings> {
  const dbc = resolveDbc(scope)
  const rows = await dbc
    .update(organizationSettings)
    .set({
      updatedAt: new Date(),
      ...(patch.staleDealDays !== undefined ? { staleDealDays: patch.staleDealDays } : {}),
    })
    .where(eq(organizationSettings.organizationId, scope.orgId))
    .returning()
  const row = rows[0]
  if (row === undefined) {
    throw new Error(`Nastavení organizace ${scope.orgId} nebylo nalezeno.`)
  }
  return toOrgSettings(row)
}
