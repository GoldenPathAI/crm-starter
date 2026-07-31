import type { ClientStatus, ServiceKind } from "@/core/types/crm.types"

export const optionalText = (value: FormDataEntryValue | null): string | undefined => {
  if (typeof value !== "string") {
    return undefined
  }
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

// Nullable columns: empty input clears the value, a filled input sets it.
export const nullableText = (value: FormDataEntryValue | null): string | null =>
  optionalText(value) ?? null

// Shape check only: any non-empty string is passed through. Membership against the
// org's enum options is enforced at the store boundary (assertValidValue).
export const isClientStatus = (value: string): value is ClientStatus => value.length > 0

export const isServiceKind = (value: string): value is ServiceKind => value.length > 0

export const parseServices = (formData: FormData): ServiceKind[] =>
  formData
    .getAll("services")
    .filter((value): value is string => typeof value === "string")
    .filter((value) => value.length > 0)

export const parseMrr = (value: FormDataEntryValue | null): number | undefined => {
  const raw = optionalText(value)
  if (raw === undefined) {
    return undefined
  }
  const parsed = Number.parseInt(raw.replace(/\s/g, ""), 10)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined
}
