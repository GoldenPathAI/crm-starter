import { timingSafeEqual } from "node:crypto"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

const INTERNAL_TOKEN_HEADER = "x-internal-token"

const constantTimeEqual = (a: string, b: string): boolean => {
  const bufferA = Buffer.from(a, "utf8")
  const bufferB = Buffer.from(b, "utf8")
  if (bufferA.length !== bufferB.length) {
    // Compare same-length buffers so a length mismatch stays timing-constant.
    const fallback = Buffer.alloc(bufferA.length)
    timingSafeEqual(bufferA, fallback)

    return false
  }

  return timingSafeEqual(bufferA, bufferB)
}

export function requireInternalToken(request: NextRequest): NextResponse | null {
  const expectedToken = process.env.INTERNAL_API_TOKEN
  if (expectedToken === undefined || expectedToken.trim().length === 0) {
    return NextResponse.json({ error: "Internal API not configured" }, { status: 503 })
  }

  const providedToken = request.headers.get(INTERNAL_TOKEN_HEADER)
  if (providedToken === null) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (!constantTimeEqual(providedToken, expectedToken)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  return null
}
