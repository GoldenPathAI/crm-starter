"use server"

import { revalidatePath } from "next/cache"
import {
  createDocument,
  deleteDocument,
  getDocumentById,
  updateDocument,
} from "@/lib/crm/store/documents"
import { requireOrgContext } from "@/lib/auth/org-context"
import { orgHref } from "@/lib/nav"
import { config } from "@/lib/config"
import {
  deleteDocumentFile,
  presignDocumentDownload,
  presignDocumentUpload,
} from "@/lib/files/s3"
import { withUiAudit } from "@/app/_lib/auditedAction"
import type { ActionState } from "@/app/_lib/actionState"
import { parseAmount, type DocumentFileValue, type DocumentFormValues } from "./_lib/documentForm"

const errorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback

const trimmedOrUndefined = (value: string): string | undefined => {
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

interface ParsedDocument {
  kind: DocumentFormValues["kind"]
  title: string
  url?: string
  amountCzk?: number
  file?: DocumentFileValue
}

const parseDocument = (values: DocumentFormValues): ParsedDocument | null => {
  const title = values.title.trim()
  if (title.length === 0) {
    return null
  }
  return {
    kind: values.kind,
    title,
    url: trimmedOrUndefined(values.url),
    amountCzk: parseAmount(values.amountCzk),
    file: values.file,
  }
}

export type PresignUploadResult =
  | { status: "success"; key: string; url: string }
  | { status: "error"; message: string }

// Hands the client a short-lived, content-type-bound PUT URL so the browser uploads
// the file straight to S3. The document row is created only afterwards, carrying the
// returned key.
export async function presignDocumentUploadAction(
  orgSlug: string,
  fileName: string,
  contentType: string,
  fileSize: number,
): Promise<PresignUploadResult> {
  const ctx = await requireOrgContext(orgSlug)
  const trimmedName = fileName.trim()
  if (trimmedName.length === 0) {
    return { status: "error", message: "Soubor nemá název." }
  }
  if (fileSize <= 0) {
    return { status: "error", message: "Soubor je prázdný." }
  }
  if (fileSize > config.files.maxUploadBytes) {
    return { status: "error", message: "Soubor je větší než 25 MB." }
  }
  try {
    const upload = await presignDocumentUpload(ctx.scope.orgId, trimmedName, contentType)
    return { status: "success", key: upload.key, url: upload.url }
  } catch {
    return { status: "error", message: "Nahrání souboru se nepodařilo připravit." }
  }
}

export type PresignDownloadResult =
  | { status: "success"; url: string }
  | { status: "error"; message: string }

// Resolves an org-scoped document's file to a short-lived download URL. Refuses when
// the document is unknown to this workspace or has no attached file.
export async function presignDocumentDownloadAction(
  orgSlug: string,
  documentId: string,
): Promise<PresignDownloadResult> {
  const ctx = await requireOrgContext(orgSlug)
  const doc = await getDocumentById(ctx.scope, documentId)
  if (doc === null || doc.fileKey === undefined) {
    return { status: "error", message: "Soubor nebyl nalezen." }
  }
  try {
    const url = await presignDocumentDownload(doc.fileKey, doc.fileName ?? "soubor")
    return { status: "success", url }
  } catch {
    return { status: "error", message: "Stažení souboru se nepodařilo připravit." }
  }
}

export async function createDocumentAction(
  orgSlug: string,
  clientId: string,
  values: DocumentFormValues,
): Promise<ActionState> {
  const ctx = await requireOrgContext(orgSlug)
  if (clientId.length === 0) {
    return { status: "error", message: "Chybí identifikátor klienta." }
  }
  const parsed = parseDocument(values)
  if (parsed === null) {
    return { status: "error", message: "Vyplňte název dokumentu." }
  }
  try {
    await withUiAudit(ctx, (scope) => createDocument(scope, { clientId, ...parsed }))
    revalidatePath(orgHref(orgSlug, `/klienti/${clientId}`))
    return { status: "success", message: "Dokument byl přidán." }
  } catch (error) {
    return { status: "error", message: errorMessage(error, "Dokument se nepodařilo uložit.") }
  }
}

export async function updateDocumentAction(
  orgSlug: string,
  documentId: string,
  clientId: string,
  values: DocumentFormValues,
): Promise<ActionState> {
  const ctx = await requireOrgContext(orgSlug)
  if (documentId.length === 0 || clientId.length === 0) {
    return { status: "error", message: "Chybí identifikátor dokumentu." }
  }
  const parsed = parseDocument(values)
  if (parsed === null) {
    return { status: "error", message: "Vyplňte název dokumentu." }
  }
  try {
    await withUiAudit(ctx, (scope) => updateDocument(scope, documentId, parsed))
    revalidatePath(orgHref(orgSlug, `/klienti/${clientId}`))
    return { status: "success", message: "Dokument byl upraven." }
  } catch (error) {
    return { status: "error", message: errorMessage(error, "Dokument se nepodařilo upravit.") }
  }
}

export async function deleteDocumentAction(
  orgSlug: string,
  documentId: string,
  clientId: string,
): Promise<ActionState> {
  const ctx = await requireOrgContext(orgSlug)
  if (documentId.length === 0 || clientId.length === 0) {
    return { status: "error", message: "Chybí identifikátor dokumentu." }
  }
  try {
    const result = await withUiAudit(ctx, async (scope, reqId) => {
      const deleted = await deleteDocument(scope, documentId)
      return { requestId: reqId, fileKey: deleted.fileKey }
    })
    // Drop the backing S3 object once the row is gone. Best effort: a failed object
    // delete leaves an orphan but never fails the document delete.
    if (result.fileKey !== null) {
      await deleteDocumentFile(result.fileKey)
    }
    revalidatePath(orgHref(orgSlug, `/klienti/${clientId}`))
    return { status: "success", message: "Dokument byl smazán.", requestId: result.requestId }
  } catch (error) {
    return { status: "error", message: errorMessage(error, "Dokument se nepodařilo smazat.") }
  }
}
