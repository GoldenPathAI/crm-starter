"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { createClient, type ClientContactInput } from "@/lib/crm/mutations"
import { requireOrgContext } from "@/lib/auth/org-context"
import { orgHref } from "@/lib/nav"
import { withUiAudit } from "@/app/_lib/auditedAction"
import { optionalText, isClientStatus, parseServices, parseMrr } from "../_lib/clientFormParse"
import type { ActionState } from "@/app/_lib/actionState"

export async function createClientAction(
  orgSlug: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const ctx = await requireOrgContext(orgSlug)
  const name = optionalText(formData.get("name"))
  const industry = optionalText(formData.get("industry"))
  if (name === undefined) {
    return { status: "error", message: "Vyplňte název klienta." }
  }

  if (industry === undefined) {
    return { status: "error", message: "Vyplňte obor." }
  }

  const statusRaw = formData.get("status")
  const status = typeof statusRaw === "string" && isClientStatus(statusRaw) ? statusRaw : "poptavka"

  const contactName = optionalText(formData.get("contactName"))
  const primaryContact: ClientContactInput | undefined =
    contactName !== undefined
      ? {
          name: contactName,
          role: optionalText(formData.get("contactRole")),
          email: optionalText(formData.get("contactEmail")),
          phone: optionalText(formData.get("contactPhone")),
        }
      : undefined

  let clientId: string
  try {
    const client = await withUiAudit(ctx, (scope) =>
      createClient(scope, {
        name,
        industry,
        street: optionalText(formData.get("street")),
        city: optionalText(formData.get("city")),
        zip: optionalText(formData.get("zip")),
        ico: optionalText(formData.get("ico")),
        dic: optionalText(formData.get("dic")),
        website: optionalText(formData.get("website")),
        billingEmail: optionalText(formData.get("billingEmail")),
        status,
        services: parseServices(formData),
        mrrCzk: parseMrr(formData.get("mrrCzk")),
        nextStep: optionalText(formData.get("nextStep")),
        note: optionalText(formData.get("note")),
        primaryContact,
      }),
    )
    clientId = client.id
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Klienta se nepodařilo vytvořit.",
    }
  }

  revalidatePath(orgHref(orgSlug, "/klienti"))
  redirect(orgHref(orgSlug, `/klienti/${clientId}`))
}
