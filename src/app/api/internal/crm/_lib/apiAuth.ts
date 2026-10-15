import { newRequestId, runAudited } from "@/lib/crm/audit/context"
import { getOrgContext, getSessionUser } from "@/lib/auth/orgContext"
import { requireInternalToken } from "@/lib/auth/internalToken"
import { roleAtLeast } from "@/lib/auth/permissions"
import { resolveOrgScope } from "./orgScope"
import { HttpError } from "./http"
import type { OrgRole, OrgScope } from "@/core/types/crm.types"
import type { NextRequest } from "next/server"

// Header the browser client stamps on every mutating request. A cross-site page
// cannot set a custom header without a CORS preflight (which these routes never
// allow), so requiring it on session-authenticated writes blocks CSRF while the
// token path (which sends x-internal-token) is unaffected.
const CSRF_HEADER = "x-crm-web"

export interface ApiAuth {
  scope: OrgScope
  // "session" = a logged-in browser user, "token" = the machine/CLI internal token.
  via: "session" | "token"
  // Membership role for the session path; null for the fully-trusted token path.
  role: OrgRole | null
}

// Resolves either a browser session (user actor, membership-checked) or the
// internal machine token (system actor) to a single OrgScope. A present session
// always decides, so a logged-in non-member gets 403 rather than silently
// falling through to the token path; only a session-less request tries the token.
export async function resolveApiAuth(request: NextRequest, orgSlug: string): Promise<ApiAuth> {
  const sessionUser = await getSessionUser()
  if (sessionUser !== null) {
    const result = await getOrgContext(orgSlug)
    if (result.status === "org-not-found") {
      throw new HttpError(404, `Workspace ${orgSlug} nebyl nalezen.`)
    }

    if (result.status === "no-membership") {
      throw new HttpError(403, "Do tohoto workspace nemáš přístup.")
    }

    if (result.status === "no-session") {
      throw new HttpError(401, "Nepřihlášen.")
    }

    return { scope: result.context.scope, via: "session", role: result.context.role }
  }

  const tokenFailure = requireInternalToken(request)
  if (tokenFailure !== null) {
    throw new HttpError(
      tokenFailure.status,
      tokenFailure.status === 503 ? "Internal API není nakonfigurováno." : "Neautorizováno.",
    )
  }

  const scope = await resolveOrgScope(orgSlug)

  return { scope, via: "token", role: null }
}

export function assertCsrf(request: NextRequest, auth: ApiAuth): void {
  if (auth.via !== "session") {
    return
  }

  if (request.headers.get(CSRF_HEADER) !== "1") {
    throw new HttpError(403, "Chybí CSRF hlavička.")
  }
}

export function assertRole(auth: ApiAuth, minRole: OrgRole): void {
  // The token path is fully trusted machine access and bypasses role gating.
  if (auth.via !== "session") {
    return
  }

  if (auth.role === null || !roleAtLeast(auth.role, minRole)) {
    throw new HttpError(403, "Na tuto akci nemáš dostatečné oprávnění.")
  }
}

// Runs a mutation under audit attribution. A session (human) write is wrapped in
// one audited transaction (source "ui") so the DB trigger attributes every row to
// the acting user and the batch is undoable; the machine/system path stays
// unattributed exactly as the token API always behaved. `fn` gets a scope whose
// `db` is the open transaction (session path) and the batch requestId.
export async function withApiAudit<T>(
  auth: ApiAuth,
  fn: (scope: OrgScope, requestId: string) => Promise<T>,
): Promise<T> {
  const requestId = newRequestId()
  if (auth.via === "session" && auth.scope.actor.type === "user") {
    return runAudited(
      {
        orgId: auth.scope.orgId,
        source: "ui",
        requestId,
        actorType: "user",
        actorUserId: auth.scope.actor.userId,
      },
      (tx) => fn({ ...auth.scope, db: tx }, requestId),
    )
  }

  return fn(auth.scope, requestId)
}
