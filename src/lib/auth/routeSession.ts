import { headers } from "next/headers"
import { auth } from "@/lib/auth/auth"

// Route-handler equivalent of requireSession: returns whether the caller carries a
// valid session, without redirecting (routes choose their own response).
export async function hasValidSession(): Promise<boolean> {
  const session = await auth.api.getSession({ headers: await headers() })

  return session !== null
}
