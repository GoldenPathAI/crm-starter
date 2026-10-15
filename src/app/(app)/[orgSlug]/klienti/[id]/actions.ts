"use server"

import { revalidatePath } from "next/cache"
import { addActivity } from "@/lib/crm/store/activities"
import { createPerson, deletePerson, setPrimaryPerson, updatePerson } from "@/lib/crm/store/people"
import { deleteClient, updateClient, type UpdateClientPatch } from "@/lib/crm/store/clients"
import { deleteActivity, updateActivity } from "@/lib/crm/store/activities"
import { requireOrgContext } from "@/lib/auth/orgContext"
import { orgHref } from "@/lib/nav"
import { withUiAudit } from "@/app/_lib/auditedAction"
import {
  isClientStatus,
  nullableText,
  optionalText,
  parseMrr,
  parseServices,
} from "../_lib/clientFormParse"
import type { ActionState } from "@/app/_lib/actionState"
import { isOneOf } from "@/lib/literals"
import { ACTIVITY_KINDS, type ActivityKind } from "./_lib/activityKinds"

const errorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback

export async function addClientActivityAction(
  orgSlug: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const ctx = await requireOrgContext(orgSlug)
  const clientId = formData.get("clientId")
  const type = formData.get("type")
  const title = formData.get("title")
  const bodyValue = formData.get("body")

  if (typeof clientId !== "string" || clientId.length === 0) {
    return { status: "error", message: "Chybí identifikátor klienta." }
  }

  if (typeof type !== "string" || !isOneOf(ACTIVITY_KINDS, type)) {
    return { status: "error", message: "Neplatný typ aktivity." }
  }

  if (typeof title !== "string" || title.trim().length === 0) {
    return { status: "error", message: "Vyplňte nadpis." }
  }

  const body =
    typeof bodyValue === "string" && bodyValue.trim().length > 0 ? bodyValue.trim() : undefined

  const SUCCESS_MESSAGE: Readonly<Record<ActivityKind, string>> = {
    hovor: "Hovor byl zalogován.",
    schuzka: "Schůzka byla zalogována.",
    poznamka: "Poznámka byla přidána.",
  }

  try {
    await withUiAudit(ctx, (scope) =>
      addActivity(scope, { clientId, type, title: title.trim(), body }),
    )
    revalidatePath(orgHref(orgSlug, `/klienti/${clientId}`))

    return { status: "success", message: SUCCESS_MESSAGE[type] }
  } catch (error) {
    return { status: "error", message: errorMessage(error, "Akci se nepodařilo uložit.") }
  }
}

export async function updateClientAction(
  orgSlug: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const ctx = await requireOrgContext(orgSlug)
  const clientId = formData.get("clientId")
  if (typeof clientId !== "string" || clientId.length === 0) {
    return { status: "error", message: "Chybí identifikátor klienta." }
  }

  const name = optionalText(formData.get("name"))
  const industry = optionalText(formData.get("industry"))
  if (name === undefined) {
    return { status: "error", message: "Vyplňte název klienta." }
  }

  if (industry === undefined) {
    return { status: "error", message: "Vyplňte obor." }
  }

  const statusRaw = formData.get("status")
  const status = typeof statusRaw === "string" && isClientStatus(statusRaw) ? statusRaw : undefined
  const parsedMrr = parseMrr(formData.get("mrrCzk"))
  const labelsRaw = formData.get("labels")
  const labels =
    typeof labelsRaw === "string"
      ? labelsRaw
          .split(",")
          .map((label) => label.trim())
          .filter((label) => label.length > 0)
      : []

  const patch: UpdateClientPatch = {
    name,
    industry,
    street: nullableText(formData.get("street")),
    city: nullableText(formData.get("city")),
    zip: nullableText(formData.get("zip")),
    ico: nullableText(formData.get("ico")),
    dic: nullableText(formData.get("dic")),
    website: nullableText(formData.get("website")),
    billingEmail: nullableText(formData.get("billingEmail")),
    services: parseServices(formData),
    mrrCzk: parsedMrr ?? null,
    nextStep: nullableText(formData.get("nextStep")),
    note: nullableText(formData.get("note")),
    labels,
    ...(status !== undefined ? { status } : {}),
  }

  try {
    await withUiAudit(ctx, (scope) => updateClient(scope, clientId, patch))
    revalidatePath(orgHref(orgSlug, "/klienti"))
    revalidatePath(orgHref(orgSlug, `/klienti/${clientId}`))

    return { status: "success", message: "Klient byl upraven." }
  } catch (error) {
    return { status: "error", message: errorMessage(error, "Klienta se nepodařilo upravit.") }
  }
}

export async function updateClientFieldAction(
  orgSlug: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const ctx = await requireOrgContext(orgSlug)
  const clientId = formData.get("clientId")
  const field = formData.get("field")
  if (typeof clientId !== "string" || clientId.length === 0) {
    return { status: "error", message: "Chybí identifikátor klienta." }
  }

  if (field !== "nextStep" && field !== "note") {
    return { status: "error", message: "Neplatné pole." }
  }

  const value = nullableText(formData.get("value"))
  const patch: UpdateClientPatch = field === "nextStep" ? { nextStep: value } : { note: value }

  try {
    await withUiAudit(ctx, (scope) => updateClient(scope, clientId, patch))
    revalidatePath(orgHref(orgSlug, "/klienti"))
    revalidatePath(orgHref(orgSlug, `/klienti/${clientId}`))

    return {
      status: "success",
      message: field === "nextStep" ? "Další krok upraven." : "Poznámka upravena.",
    }
  } catch (error) {
    return { status: "error", message: errorMessage(error, "Změnu se nepodařilo uložit.") }
  }
}

export async function endClientAction(orgSlug: string, clientId: string): Promise<ActionState> {
  const ctx = await requireOrgContext(orgSlug)
  if (clientId.length === 0) {
    return { status: "error", message: "Chybí identifikátor klienta." }
  }

  try {
    const requestId = await withUiAudit(ctx, async (scope, reqId) => {
      await updateClient(scope, clientId, { status: "ukonceny" })

      return reqId
    })
    revalidatePath(orgHref(orgSlug, "/klienti"))
    revalidatePath(orgHref(orgSlug, `/klienti/${clientId}`))

    return { status: "success", message: "Spolupráce byla ukončena.", requestId }
  } catch (error) {
    return { status: "error", message: errorMessage(error, "Změnu se nepodařilo uložit.") }
  }
}

export async function deleteClientAction(orgSlug: string, clientId: string): Promise<ActionState> {
  const ctx = await requireOrgContext(orgSlug)
  if (clientId.length === 0) {
    return { status: "error", message: "Chybí identifikátor klienta." }
  }

  try {
    const requestId = await withUiAudit(ctx, async (scope, reqId) => {
      await deleteClient(scope, clientId)

      return reqId
    })
    revalidatePath(orgHref(orgSlug, "/klienti"))

    return { status: "success", message: "Klient byl smazán.", requestId }
  } catch (error) {
    return { status: "error", message: errorMessage(error, "Klienta se nepodařilo smazat.") }
  }
}

export async function createPersonAction(
  orgSlug: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const ctx = await requireOrgContext(orgSlug)
  const clientId = formData.get("clientId")
  if (typeof clientId !== "string" || clientId.length === 0) {
    return { status: "error", message: "Chybí identifikátor klienta." }
  }

  const name = optionalText(formData.get("name"))
  if (name === undefined) {
    return { status: "error", message: "Vyplňte jméno kontaktu." }
  }

  try {
    await withUiAudit(ctx, (scope) =>
      createPerson(scope, {
        clientId,
        name,
        role: optionalText(formData.get("role")),
        email: optionalText(formData.get("email")),
        phone: optionalText(formData.get("phone")),
        isPrimary: formData.get("isPrimary") === "on",
      }),
    )
    revalidatePath(orgHref(orgSlug, `/klienti/${clientId}`))

    return { status: "success", message: "Kontakt byl přidán." }
  } catch (error) {
    return { status: "error", message: errorMessage(error, "Kontakt se nepodařilo uložit.") }
  }
}

export async function updatePersonAction(
  orgSlug: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const ctx = await requireOrgContext(orgSlug)
  const personId = formData.get("personId")
  const clientId = formData.get("clientId")
  if (typeof personId !== "string" || personId.length === 0) {
    return { status: "error", message: "Chybí identifikátor kontaktu." }
  }

  if (typeof clientId !== "string" || clientId.length === 0) {
    return { status: "error", message: "Chybí identifikátor klienta." }
  }

  const name = optionalText(formData.get("name"))
  if (name === undefined) {
    return { status: "error", message: "Vyplňte jméno kontaktu." }
  }

  try {
    await withUiAudit(ctx, (scope) =>
      updatePerson(scope, personId, {
        name,
        role: nullableText(formData.get("role")),
        email: nullableText(formData.get("email")),
        phone: nullableText(formData.get("phone")),
      }),
    )
    revalidatePath(orgHref(orgSlug, `/klienti/${clientId}`))

    return { status: "success", message: "Kontakt byl upraven." }
  } catch (error) {
    return { status: "error", message: errorMessage(error, "Kontakt se nepodařilo upravit.") }
  }
}

export async function deletePersonAction(
  orgSlug: string,
  personId: string,
  clientId: string,
): Promise<ActionState> {
  const ctx = await requireOrgContext(orgSlug)
  if (personId.length === 0 || clientId.length === 0) {
    return { status: "error", message: "Chybí identifikátor kontaktu." }
  }

  try {
    const requestId = await withUiAudit(ctx, async (scope, reqId) => {
      await deletePerson(scope, personId)

      return reqId
    })
    revalidatePath(orgHref(orgSlug, `/klienti/${clientId}`))

    return { status: "success", message: "Kontakt byl smazán.", requestId }
  } catch (error) {
    return { status: "error", message: errorMessage(error, "Kontakt se nepodařilo smazat.") }
  }
}

export async function setPrimaryPersonAction(
  orgSlug: string,
  personId: string,
  clientId: string,
): Promise<ActionState> {
  const ctx = await requireOrgContext(orgSlug)
  if (personId.length === 0 || clientId.length === 0) {
    return { status: "error", message: "Chybí identifikátor kontaktu." }
  }

  try {
    await withUiAudit(ctx, (scope) => setPrimaryPerson(scope, personId))
    revalidatePath(orgHref(orgSlug, `/klienti/${clientId}`))

    return { status: "success", message: "Primární kontakt nastaven." }
  } catch (error) {
    return { status: "error", message: errorMessage(error, "Změnu se nepodařilo uložit.") }
  }
}

export async function updateClientStatusAction(
  orgSlug: string,
  clientId: string,
  status: string,
): Promise<ActionState> {
  const ctx = await requireOrgContext(orgSlug)
  if (clientId.length === 0) {
    return { status: "error", message: "Chybí identifikátor klienta." }
  }

  if (!isClientStatus(status)) {
    return { status: "error", message: "Neplatný status." }
  }

  try {
    await withUiAudit(ctx, (scope) => updateClient(scope, clientId, { status }))
    revalidatePath(orgHref(orgSlug, "/klienti"))
    revalidatePath(orgHref(orgSlug, `/klienti/${clientId}`))

    return { status: "success", message: "Status byl změněn." }
  } catch (error) {
    return { status: "error", message: errorMessage(error, "Status se nepodařilo změnit.") }
  }
}

export async function updateActivityAction(
  orgSlug: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const ctx = await requireOrgContext(orgSlug)
  const activityId = formData.get("activityId")
  const clientId = formData.get("clientId")
  const title = formData.get("title")
  const bodyValue = formData.get("body")
  if (typeof activityId !== "string" || activityId.length === 0) {
    return { status: "error", message: "Chybí identifikátor aktivity." }
  }

  if (typeof clientId !== "string" || clientId.length === 0) {
    return { status: "error", message: "Chybí identifikátor klienta." }
  }

  if (typeof title !== "string" || title.trim().length === 0) {
    return { status: "error", message: "Vyplňte nadpis." }
  }

  const body =
    typeof bodyValue === "string" && bodyValue.trim().length > 0 ? bodyValue.trim() : undefined
  try {
    await withUiAudit(ctx, (scope) =>
      updateActivity(scope, activityId, { title: title.trim(), body }),
    )
    revalidatePath(orgHref(orgSlug, `/klienti/${clientId}`))

    return { status: "success", message: "Aktivita byla upravena." }
  } catch (error) {
    return { status: "error", message: errorMessage(error, "Aktivitu se nepodařilo upravit.") }
  }
}

export async function deleteActivityAction(
  orgSlug: string,
  activityId: string,
  clientId: string,
): Promise<ActionState> {
  const ctx = await requireOrgContext(orgSlug)
  if (activityId.length === 0 || clientId.length === 0) {
    return { status: "error", message: "Chybí identifikátor aktivity." }
  }

  try {
    const requestId = await withUiAudit(ctx, async (scope, reqId) => {
      await deleteActivity(scope, activityId)

      return reqId
    })
    revalidatePath(orgHref(orgSlug, `/klienti/${clientId}`))

    return { status: "success", message: "Aktivita byla smazána.", requestId }
  } catch (error) {
    return { status: "error", message: errorMessage(error, "Aktivitu se nepodařilo smazat.") }
  }
}
