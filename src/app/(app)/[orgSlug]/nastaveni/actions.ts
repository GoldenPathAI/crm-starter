"use server"

import { revalidatePath } from "next/cache"
import { headers } from "next/headers"
import type { OrgRole } from "@/core/types/crm.types"
import { auth, takeInvitationEmailOutcome } from "@/lib/auth/auth"
import { requireOrgContext, requireRole } from "@/lib/auth/org-context"
import {
  isLastOwnerDemotion,
  isLastOwnerRemoval,
  listSettingsMembers,
} from "@/lib/crm/store/members"
import { orgHref } from "@/lib/nav"
import type { ActionState } from "@/app/_lib/actionState"

function parseRole(value: string): OrgRole | null {
  if (value === "owner" || value === "admin" || value === "member") {
    return value
  }

  return null
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.length > 0 ? error.message : fallback
}

export async function changeMemberRoleAction(
  orgSlug: string,
  input: { memberId: string; role: string },
): Promise<ActionState> {
  const ctx = await requireOrgContext(orgSlug)
  requireRole(ctx, "admin")
  const nextRole = parseRole(input.role)
  if (nextRole === null) {
    return { status: "error", message: "Neplatná role." }
  }

  const members = await listSettingsMembers(ctx.scope.orgId)
  const target = members.find((member) => member.memberId === input.memberId)
  if (target === undefined) {
    return { status: "error", message: "Člen nebyl nalezen." }
  }

  if ((nextRole === "owner" || target.role === "owner") && ctx.role !== "owner") {
    return { status: "error", message: "Roli vlastníka může měnit jen vlastník." }
  }

  if (isLastOwnerDemotion(members, input.memberId, nextRole)) {
    return { status: "error", message: "Nelze odebrat posledního vlastníka workspace." }
  }

  try {
    await auth.api.updateMemberRole({
      body: { memberId: input.memberId, role: nextRole, organizationId: ctx.scope.orgId },
      headers: await headers(),
    })
    revalidatePath(orgHref(orgSlug, "/nastaveni"))

    return { status: "success", message: "Role byla změněna." }
  } catch (error) {
    return { status: "error", message: errorMessage(error, "Roli se nepodařilo změnit.") }
  }
}

export async function removeMemberAction(
  orgSlug: string,
  input: { memberId: string },
): Promise<ActionState> {
  const ctx = await requireOrgContext(orgSlug)
  requireRole(ctx, "admin")
  const members = await listSettingsMembers(ctx.scope.orgId)
  const target = members.find((member) => member.memberId === input.memberId)
  if (target === undefined) {
    return { status: "error", message: "Člen nebyl nalezen." }
  }

  if (target.role === "owner" && ctx.role !== "owner") {
    return { status: "error", message: "Vlastníka může odebrat jen vlastník." }
  }

  if (isLastOwnerRemoval(members, input.memberId)) {
    return { status: "error", message: "Nelze odebrat posledního vlastníka workspace." }
  }

  try {
    await auth.api.removeMember({
      body: { memberIdOrEmail: input.memberId, organizationId: ctx.scope.orgId },
      headers: await headers(),
    })
    revalidatePath(orgHref(orgSlug, "/nastaveni"))

    return { status: "success", message: "Člen byl odebrán." }
  } catch (error) {
    return { status: "error", message: errorMessage(error, "Člena se nepodařilo odebrat.") }
  }
}

export async function inviteMemberAction(
  orgSlug: string,
  input: { email: string; role: string },
): Promise<ActionState> {
  const ctx = await requireOrgContext(orgSlug)
  requireRole(ctx, "admin")
  const email = input.email.trim().toLowerCase()
  if (email.length === 0 || !email.includes("@")) {
    return { status: "error", message: "Zadejte platný e-mail." }
  }

  const role: OrgRole = input.role === "admin" ? "admin" : "member"
  try {
    await auth.api.createInvitation({
      body: { email, role, organizationId: ctx.scope.orgId },
      headers: await headers(),
    })
    const emailSent = takeInvitationEmailOutcome(email)
    revalidatePath(orgHref(orgSlug, "/nastaveni"))

    return {
      status: "success",
      message:
        emailSent === false
          ? "Pozvánka vytvořena, ale e-mail se nepodařilo odeslat. Pošli pozvánkový odkaz ručně."
          : `Pozvánka odeslána na ${email}.`,
    }
  } catch (error) {
    return { status: "error", message: errorMessage(error, "Pozvánku se nepodařilo vytvořit.") }
  }
}

export async function revokeInvitationAction(
  orgSlug: string,
  input: { invitationId: string },
): Promise<ActionState> {
  const ctx = await requireOrgContext(orgSlug)
  requireRole(ctx, "admin")
  try {
    await auth.api.cancelInvitation({
      body: { invitationId: input.invitationId },
      headers: await headers(),
    })
    revalidatePath(orgHref(orgSlug, "/nastaveni"))

    return { status: "success", message: "Pozvánka byla zrušena." }
  } catch (error) {
    return { status: "error", message: errorMessage(error, "Pozvánku se nepodařilo zrušit.") }
  }
}
