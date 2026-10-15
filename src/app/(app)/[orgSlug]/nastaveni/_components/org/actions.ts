"use server"

import { revalidatePath } from "next/cache"
import type { ActionState } from "@/app/_lib/actionState"
import { requireOrgContext, requireRole } from "@/lib/auth/orgContext"
import { withUiAudit } from "@/app/_lib/auditedAction"
import { updateOrgSettings, type UpdateOrgSettingsPatch } from "@/lib/crm/store/orgSettings"
import { updateOrganizationName } from "@/lib/crm/store/organizations"

function revalidateOrg(orgSlug: string): void {
  revalidatePath(`/${orgSlug}`, "layout")
}

function toActionError(error: unknown): ActionState {
  return { status: "error", message: error instanceof Error ? error.message : "Akce selhala." }
}

export async function updateOrganizationNameAction(
  orgSlug: string,
  name: string,
): Promise<ActionState> {
  const ctx = await requireOrgContext(orgSlug)
  try {
    requireRole(ctx, "owner")
    await updateOrganizationName(ctx.scope, name)
    revalidateOrg(orgSlug)

    return { status: "success", message: "Název uložen." }
  } catch (error) {
    return toActionError(error)
  }
}

export async function updateOrgSettingsAction(
  orgSlug: string,
  patch: UpdateOrgSettingsPatch,
): Promise<ActionState> {
  const ctx = await requireOrgContext(orgSlug)
  try {
    requireRole(ctx, "owner")
    await withUiAudit(ctx, (scope) => updateOrgSettings(scope, patch))
    revalidateOrg(orgSlug)

    return { status: "success", message: "Nastavení uloženo." }
  } catch (error) {
    return toActionError(error)
  }
}
