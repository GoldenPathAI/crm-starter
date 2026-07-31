import { NextResponse } from "next/server"

// Carries an HTTP status alongside a user-safe message so route handlers can
// translate validation and lookup failures into the right response code.
export class HttpError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = "HttpError"
    this.status = status
  }
}

export const jsonError = (message: string, status: number): NextResponse =>
  NextResponse.json({ error: message }, { status })

export const badRequest = (message: string): NextResponse => jsonError(message, 400)

export const notFound = (message: string): NextResponse => jsonError(message, 404)

export const ok = (data: unknown): NextResponse => NextResponse.json(data)

export const created = (data: unknown): NextResponse => NextResponse.json(data, { status: 201 })

export function errorResponse(error: unknown): NextResponse {
  if (error instanceof HttpError) {
    return jsonError(error.message, error.status)
  }
  if (error instanceof Error) {
    // Store lookups throw plain Errors ending in "nebyl nalezen." etc.
    if (/nalezen/i.test(error.message)) {
      return jsonError(error.message, 404)
    }
    // Store business-rule refusals (client still has related rows, subtask of a subtask).
    if (/navázané|další podúkoly/i.test(error.message)) {
      return jsonError(error.message, 409)
    }
    return jsonError(error.message, 500)
  }
  return jsonError("Neočekávaná chyba.", 500)
}

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

export async function readJsonObject(request: Request): Promise<Record<string, unknown>> {
  const raw = await request.text()
  if (raw.trim().length === 0) {
    return {}
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new HttpError(400, "Neplatné JSON tělo požadavku.")
  }
  if (!isRecord(parsed)) {
    throw new HttpError(400, "Tělo požadavku musí být JSON objekt.")
  }
  return parsed
}

export const asString = (value: unknown): string | undefined =>
  typeof value === "string" ? value : undefined

export const asTrimmed = (value: unknown): string | undefined => {
  const str = asString(value)
  if (str === undefined) {
    return undefined
  }
  const trimmed = str.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

export const asNumber = (value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : undefined
  }
  return undefined
}

export const asBoolean = (value: unknown): boolean | undefined => {
  if (typeof value === "boolean") {
    return value
  }
  if (value === "true" || value === "1") {
    return true
  }
  if (value === "false" || value === "0") {
    return false
  }
  return undefined
}

export const asStringArray = (value: unknown): string[] | undefined => {
  if (!Array.isArray(value)) {
    return undefined
  }
  const strings = value.filter((entry): entry is string => typeof entry === "string")
  return strings.length === value.length ? strings : undefined
}

export const matchEnum = <T extends string>(
  value: unknown,
  allowed: readonly T[],
): T | undefined => {
  const str = asTrimmed(value)
  if (str === undefined) {
    return undefined
  }
  return allowed.find((candidate) => candidate === str)
}

export const matchEnumList = <T extends string>(
  value: unknown,
  allowed: readonly T[],
): T[] | undefined => {
  const list = asStringArray(value)
  if (list === undefined) {
    return undefined
  }
  const matched = list
    .map((entry) => entry.trim())
    .filter((entry): entry is T => allowed.some((candidate) => candidate === entry))
  return matched.length === list.filter((entry) => entry.trim().length > 0).length
    ? matched
    : undefined
}

// Next.js 15 hands dynamic segments to route handlers as a Promise.
export type RouteContext<TParams> = { params: Promise<TParams> }
