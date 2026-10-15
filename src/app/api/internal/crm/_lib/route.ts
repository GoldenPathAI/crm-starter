import { resolveApiAuth, assertCsrf, assertRole } from "./api-auth"
import { errorResponse } from "./http"
import type { ApiAuth } from "./api-auth"
import type { OrgRole } from "@/core/types/crm.types"
import type { NextRequest, NextResponse } from "next/server"

interface RouteOptions {
  // A state-changing handler: enforces the CSRF header on the session path.
  mutation?: boolean
  // Minimum membership role for the session path (token path is trusted, bypasses).
  minRole?: OrgRole
}

type Handler<P> = (args: {
  request: NextRequest
  params: P
  auth: ApiAuth
}) => Promise<NextResponse> | NextResponse

// Single wrapper every internal CRM route handler uses. Resolves dual auth
// (session user or machine token), enforces CSRF + role on the session path, and
// funnels every throw through errorResponse, so each handler body is just
// validate -> store -> respond. Standard shape also lets the CLI discover every
// endpoint by scanning for `export const <METHOD> = route(...)`.
export function route<P extends { orgSlug: string }>(options: RouteOptions, handler: Handler<P>) {
  return async (request: NextRequest, context: { params: Promise<P> }): Promise<NextResponse> => {
    try {
      const params = await context.params
      const auth = await resolveApiAuth(request, params.orgSlug)
      if (options.mutation === true) {
        assertCsrf(request, auth)
      }

      if (options.minRole !== undefined) {
        assertRole(auth, options.minRole)
      }

      return await handler({ request, params, auth })
    } catch (error) {
      return errorResponse(error)
    }
  }
}
