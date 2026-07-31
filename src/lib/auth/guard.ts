import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { auth } from "@/lib/auth/auth"

// Middleware only gates page navigations, and its matcher exempts /login (and any
// dotted path). Next.js dispatches a Server Action by its id on ANY route, so an
// action id POSTed to an exempt path would otherwise run without a session. Every
// mutating action calls this first so the session is verified in-action, not only
// at the middleware boundary. Throws a redirect to /login when there is no session.
export async function requireSession(): Promise<void> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (session === null) {
    redirect("/login")
  }
}
