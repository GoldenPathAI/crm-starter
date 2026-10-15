"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { createProject } from "@/lib/crm/store/projects"
import { requireOrgContext } from "@/lib/auth/orgContext"
import { orgHref } from "@/lib/nav"
import { withUiAudit } from "@/app/_lib/auditedAction"
import type { ActionState } from "@/app/_lib/actionState"

export interface CreateProjectPayload {
  clientId: string
  name: string
  description: string
  status: string
  startedAt: string
  dueAt: string
  budgetCzk: number | null
  dealId: string
}

const optionalText = (value: string): string | undefined => {
  const trimmed = value.trim()

  return trimmed.length > 0 ? trimmed : undefined
}

export async function createProjectAction(
  orgSlug: string,
  input: CreateProjectPayload,
): Promise<ActionState> {
  const ctx = await requireOrgContext(orgSlug)
  if (input.clientId.length === 0) {
    return { status: "error", message: "Vyberte klienta." }
  }

  if (input.name.trim().length === 0) {
    return { status: "error", message: "Vyplňte název projektu." }
  }

  let projectId: string
  try {
    const project = await withUiAudit(ctx, (scope) =>
      createProject(scope, {
        clientId: input.clientId,
        name: input.name.trim(),
        description: optionalText(input.description),
        status: input.status,
        startedAt: optionalText(input.startedAt),
        dueAt: optionalText(input.dueAt),
        budgetCzk: input.budgetCzk ?? undefined,
        dealId: optionalText(input.dealId),
      }),
    )
    projectId = project.id
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Projekt se nepodařilo vytvořit.",
    }
  }

  revalidatePath(orgHref(orgSlug, "/projekty"))
  redirect(orgHref(orgSlug, `/projekty/${projectId}`))
}
