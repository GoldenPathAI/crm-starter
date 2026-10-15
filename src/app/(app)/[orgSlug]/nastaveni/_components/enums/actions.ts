"use server"

import { revalidatePath } from "next/cache"
import type { ActionState } from "@/app/_lib/actionState"
import type { EnumKind } from "@/core/types/crm.types"
import { requireOrgContext, requireRole } from "@/lib/auth/org-context"
import { withUiAudit } from "@/app/_lib/auditedAction"
import {
  archiveEnumOption,
  createEnumOption,
  reorderEnumOptions,
  unarchiveEnumOption,
  updateEnumOption,
  type CreateEnumOptionInput,
  type UpdateEnumOptionPatch,
} from "@/lib/crm/store/enum-options"

// Enum edits change every surface that renders a badge or column, so the whole org
// subtree is revalidated, not just the settings page.
function revalidateOrg(orgSlug: string): void {
  revalidatePath(`/${orgSlug}`, "layout")
}

function toActionError(error: unknown): ActionState {
  return { status: "error", message: error instanceof Error ? error.message : "Akce selhala." }
}

export async function createEnumOptionAction(
  orgSlug: string,
  kind: EnumKind,
  input: CreateEnumOptionInput,
): Promise<ActionState> {
  const ctx = await requireOrgContext(orgSlug)
  try {
    requireRole(ctx, "admin")
    await withUiAudit(ctx, (scope) => createEnumOption(scope, kind, input))
    revalidateOrg(orgSlug)

    return { status: "success", message: "Hodnota přidána." }
  } catch (error) {
    return toActionError(error)
  }
}

export async function updateEnumOptionAction(
  orgSlug: string,
  id: string,
  patch: UpdateEnumOptionPatch,
): Promise<ActionState> {
  const ctx = await requireOrgContext(orgSlug)
  try {
    requireRole(ctx, "admin")
    await withUiAudit(ctx, (scope) => updateEnumOption(scope, id, patch))
    revalidateOrg(orgSlug)

    return { status: "success", message: "Hodnota uložena." }
  } catch (error) {
    return toActionError(error)
  }
}

export async function reorderEnumOptionsAction(
  orgSlug: string,
  kind: EnumKind,
  orderedIds: string[],
): Promise<ActionState> {
  const ctx = await requireOrgContext(orgSlug)
  try {
    requireRole(ctx, "admin")
    await withUiAudit(ctx, (scope) => reorderEnumOptions(scope, kind, orderedIds))
    revalidateOrg(orgSlug)

    return { status: "success", message: "Pořadí uloženo." }
  } catch (error) {
    return toActionError(error)
  }
}

export async function archiveEnumOptionAction(orgSlug: string, id: string): Promise<ActionState> {
  const ctx = await requireOrgContext(orgSlug)
  try {
    requireRole(ctx, "admin")
    await withUiAudit(ctx, (scope) => archiveEnumOption(scope, id))
    revalidateOrg(orgSlug)

    return { status: "success", message: "Hodnota archivována." }
  } catch (error) {
    return toActionError(error)
  }
}

export async function unarchiveEnumOptionAction(orgSlug: string, id: string): Promise<ActionState> {
  const ctx = await requireOrgContext(orgSlug)
  try {
    requireRole(ctx, "admin")
    await withUiAudit(ctx, (scope) => unarchiveEnumOption(scope, id))
    revalidateOrg(orgSlug)

    return { status: "success", message: "Hodnota obnovena." }
  } catch (error) {
    return toActionError(error)
  }
}
