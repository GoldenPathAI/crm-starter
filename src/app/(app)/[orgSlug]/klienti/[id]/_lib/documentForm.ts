import type { DocKind } from "@/core/types/crm.types"

// A file already uploaded to S3, ready to attach to the document on submit.
export interface DocumentFileValue {
  key: string
  name: string
  size: number
}

export interface DocumentFormValues {
  kind: DocKind
  title: string
  amountCzk: string
  url: string
  file?: DocumentFileValue
}

// Shape check only: any non-empty string is passed through. Membership against the
// org's enum options is enforced at the store boundary (assertValidValue).
export const isDocKind = (value: string): value is DocKind => value.length > 0

export const emptyDocumentValues = (): DocumentFormValues => ({
  kind: "smlouva",
  title: "",
  amountCzk: "",
  url: "",
})

// Parses a free-typed amount ("45 000", "45000") into a non-negative integer of
// Kč, or undefined when the field is left blank or not a valid number.
export const parseAmount = (raw: string): number | undefined => {
  const trimmed = raw.replace(/\s/g, "")
  if (trimmed.length === 0) {
    return undefined
  }
  const parsed = Number.parseInt(trimmed, 10)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined
}
