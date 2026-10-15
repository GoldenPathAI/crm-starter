import type { ActionState } from "./actionState"

// Browser-side client for the internal CRM REST API. Every call is same-origin
// with the session cookie; mutations carry the x-crm-web header the server
// requires as a CSRF guard. Errors surface the server's user-safe message.
const CSRF_HEADER = "x-crm-web"

export class ApiError extends Error {
  readonly status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = "ApiError"
    this.status = status
  }
}

// Members spell the HTTP token itself: fetch upper-cases GET, POST and DELETE on its
// own but sends PATCH exactly as written.
export enum HttpMethod {
  GET = "GET",
  POST = "POST",
  PATCH = "PATCH",
  DELETE = "DELETE",
}

interface RequestOptions {
  query?: Record<string, string | number | boolean | string[] | undefined>
  body?: unknown
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

function buildQuery(query: RequestOptions["query"]): string {
  if (query === undefined) {
    return ""
  }

  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined) {
      continue
    }

    if (Array.isArray(value)) {
      for (const entry of value) {
        params.append(key, entry)
      }
    } else {
      params.append(key, String(value))
    }
  }

  const qs = params.toString()

  return qs.length > 0 ? `?${qs}` : ""
}

export async function crmApi<T>(
  orgSlug: string,
  method: HttpMethod,
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const mutation = method !== HttpMethod.GET
  const headers: Record<string, string> = {}
  if (options.body !== undefined) {
    headers["content-type"] = "application/json"
  }

  if (mutation) {
    headers[CSRF_HEADER] = "1"
  }

  const response = await fetch(
    `/api/internal/crm/${orgSlug}${path}${buildQuery(options.query)}`,
    {
      method,
      credentials: "same-origin",
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    },
  )
  const text = await response.text()
  const data: unknown = text.length > 0 ? JSON.parse(text) : null
  if (!response.ok) {
    const message = isRecord(data) && typeof data.error === "string" ? data.error : `HTTP ${response.status}`
    throw new ApiError(message, response.status)
  }

  return data as T
}

// Adapts an API call to the ActionState shape the toast/undo helpers expect, so a
// component swaps a server action for an endpoint call without touching its
// success/error handling. A `requestId` in the response body flows through for undo.
export async function apiAction(
  successMessage: string,
  call: () => Promise<unknown>,
): Promise<ActionState> {
  try {
    const data = await call()
    const requestId = isRecord(data) && typeof data.requestId === "string" ? data.requestId : undefined

    return { status: "success", message: successMessage, requestId }
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Akce se nezdařila.",
    }
  }
}
