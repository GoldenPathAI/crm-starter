import { and, asc, eq } from "drizzle-orm"
import { resolveDbc } from "@/lib/crm/store/db"
import { clients, documents } from "@/lib/db/schema/crm"
import { createId } from "@/lib/ids"
import { toDoc } from "@/lib/crm/store/mappers"
import { assertValidValue } from "@/lib/crm/enums/service"
import type { Doc, DocKind, OrgScope } from "@/core/types/crm.types"

const actorUserId = (scope: OrgScope): string | null =>
  scope.actor.type === "user" ? scope.actor.userId : null

export async function getAllDocuments(scope: OrgScope): Promise<Doc[]> {
  const dbc = resolveDbc(scope)
  const rows = await dbc
    .select()
    .from(documents)
    .where(eq(documents.organizationId, scope.orgId))
    .orderBy(asc(documents.id))

  return rows.map(toDoc)
}

export async function getDocumentById(scope: OrgScope, id: string): Promise<Doc | null> {
  const dbc = resolveDbc(scope)
  const rows = await dbc
    .select()
    .from(documents)
    .where(and(eq(documents.id, id), eq(documents.organizationId, scope.orgId)))
    .limit(1)
  const row = rows[0]

  return row === undefined ? null : toDoc(row)
}

export async function getDocumentsByClientId(scope: OrgScope, clientId: string): Promise<Doc[]> {
  const dbc = resolveDbc(scope)
  const rows = await dbc
    .select()
    .from(documents)
    .where(and(eq(documents.clientId, clientId), eq(documents.organizationId, scope.orgId)))
    .orderBy(asc(documents.id))

  return rows.map(toDoc)
}

// An uploaded file already sitting in S3. Passing it sets/replaces the document's
// file; omitting it on update leaves the existing file untouched.
export interface DocumentFileInput {
  key: string
  name: string
  size?: number
}

export interface DocumentInput {
  kind: DocKind
  title: string
  url?: string
  amountCzk?: number
  file?: DocumentFileInput
}

export interface CreateDocumentInput extends DocumentInput {
  clientId: string
}

export async function createDocument(scope: OrgScope, input: CreateDocumentInput): Promise<Doc> {
  await assertValidValue(scope.orgId, "doc_kind", input.kind)
  const dbc = resolveDbc(scope)
  const clientRows = await dbc
    .select({ id: clients.id })
    .from(clients)
    .where(and(eq(clients.id, input.clientId), eq(clients.organizationId, scope.orgId)))
    .limit(1)
  if (clientRows[0] === undefined) {
    throw new Error("Klient nebyl nalezen.")
  }

  const rows = await dbc
    .insert(documents)
    .values({
      id: createId("do"),
      organizationId: scope.orgId,
      clientId: input.clientId,
      projectId: null,
      kind: input.kind,
      title: input.title,
      url: input.url ?? null,
      amountCzk: input.amountCzk ?? null,
      fileKey: input.file?.key ?? null,
      fileName: input.file?.name ?? null,
      fileSize: input.file?.size ?? null,
      createdByUserId: actorUserId(scope),
    })
    .returning()
  const row = rows[0]
  if (row === undefined) {
    throw new Error("Dokument se nepodařilo uložit.")
  }

  return toDoc(row)
}

export async function updateDocument(
  scope: OrgScope,
  id: string,
  input: DocumentInput,
): Promise<Doc> {
  await assertValidValue(scope.orgId, "doc_kind", input.kind)
  const dbc = resolveDbc(scope)
  // File columns are only touched when a new file is supplied, so a plain metadata
  // edit keeps the existing attachment.
  const fileColumns =
    input.file !== undefined
      ? { fileKey: input.file.key, fileName: input.file.name, fileSize: input.file.size ?? null }
      : {}
  const rows = await dbc
    .update(documents)
    .set({
      kind: input.kind,
      title: input.title,
      url: input.url ?? null,
      amountCzk: input.amountCzk ?? null,
      ...fileColumns,
    })
    .where(and(eq(documents.id, id), eq(documents.organizationId, scope.orgId)))
    .returning()
  const row = rows[0]
  if (row === undefined) {
    throw new Error("Dokument nebyl nalezen.")
  }

  return toDoc(row)
}

// Returns the deleted document's file key (or null), so the caller can drop the
// backing S3 object after the row is gone.
export async function deleteDocument(
  scope: OrgScope,
  id: string,
): Promise<{ fileKey: string | null }> {
  const dbc = resolveDbc(scope)
  const rows = await dbc
    .delete(documents)
    .where(and(eq(documents.id, id), eq(documents.organizationId, scope.orgId)))
    .returning({ id: documents.id, fileKey: documents.fileKey })
  const row = rows[0]
  if (row === undefined) {
    throw new Error("Dokument nebyl nalezen.")
  }

  return { fileKey: row.fileKey }
}
