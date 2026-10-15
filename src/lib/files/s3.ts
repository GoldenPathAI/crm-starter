import { randomUUID } from "node:crypto"
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { config } from "@/lib/config"
import { createServerLogger } from "@/lib/logger"

// Credentials come from the default AWS provider chain: env vars on Railway
// (AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY), AWS_PROFILE locally. Never hardcoded.
const client = new S3Client({ region: config.files.region })

const logger = createServerLogger({ layer: "lib", module: "files-s3" })

// Keeps only characters safe in an S3 key segment and a download filename. Empty or
// all-stripped names fall back to a generic label so the key never ends in a slash.
const sanitizeFileName = (fileName: string): string => {
  const base = fileName.replace(/^.*[\\/]/, "").trim()
  const cleaned = base.replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^_+|_+$/g, "")

  return cleaned.length > 0 ? cleaned : "soubor"
}

// RFC 6266 / 5987 Content-Disposition. The plain filename is ASCII-folded for legacy
// clients; filename* carries the original UTF-8 (Czech) name.
const contentDisposition = (fileName: string): string => {
  const ascii = fileName.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "_")
  const encoded = encodeURIComponent(fileName)

  return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`
}

export interface PresignedUpload {
  key: string
  url: string
}

// Presigns a one-shot PUT for a new document file. The returned key is stored on the
// document row; the client must PUT with the same Content-Type it was signed for.
export async function presignDocumentUpload(
  orgId: string,
  fileName: string,
  contentType: string,
): Promise<PresignedUpload> {
  const key = `${orgId}/documents/${randomUUID()}/${sanitizeFileName(fileName)}`
  const command = new PutObjectCommand({
    Bucket: config.files.bucket,
    Key: key,
    ContentType: contentType,
  })
  const url = await getSignedUrl(client, command, {
    expiresIn: config.files.presignExpirySeconds,
  })

  return { key, url }
}

// Presigns a GET that forces a download with the original filename.
export async function presignDocumentDownload(key: string, fileName: string): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: config.files.bucket,
    Key: key,
    ResponseContentDisposition: contentDisposition(fileName),
  })

  return getSignedUrl(client, command, { expiresIn: config.files.presignExpirySeconds })
}

// Presigns a GET that renders inline (PDF preview in an iframe) instead of downloading.
export async function presignDocumentInline(key: string, contentType: string): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: config.files.bucket,
    Key: key,
    ResponseContentDisposition: "inline",
    ResponseContentType: contentType,
  })

  return getSignedUrl(client, command, { expiresIn: config.files.presignExpirySeconds })
}

export async function presignObjectRead(key: string): Promise<string> {
  const command = new GetObjectCommand({ Bucket: config.files.bucket, Key: key })

  return getSignedUrl(client, command, { expiresIn: config.files.presignExpirySeconds })
}

// Uploads bytes we produced server-side (a rendered invoice PDF) straight to S3, no
// presign round-trip. The caller owns the key layout.
export async function putObjectBytes(
  key: string,
  bytes: Uint8Array,
  contentType: string,
): Promise<void> {
  await client.send(
    new PutObjectCommand({
      Bucket: config.files.bucket,
      Key: key,
      Body: bytes,
      ContentType: contentType,
    }),
  )
}

// Reads an object back into memory (a stored invoice PDF served through the app).
export async function getObjectBytes(key: string): Promise<Uint8Array> {
  const response = await client.send(
    new GetObjectCommand({ Bucket: config.files.bucket, Key: key }),
  )
  const body = response.Body
  if (body === undefined) {
    throw new Error("Soubor nebyl v úložišti nalezen.")
  }

  return body.transformToByteArray()
}

// Best effort: a failed delete is logged, not thrown, so removing a document never
// fails just because its S3 object was already gone.
export async function deleteDocumentFile(key: string): Promise<void> {
  try {
    await client.send(new DeleteObjectCommand({ Bucket: config.files.bucket, Key: key }))
  } catch (error) {
    logger.error(
      { key, error: error instanceof Error ? error.message : String(error) },
      "Smazani souboru z S3 selhalo",
    )
  }
}
