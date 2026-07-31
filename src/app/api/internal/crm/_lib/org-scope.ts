import { eq } from "drizzle-orm"
import { db } from "@/lib/db/client"
import { organizations } from "@/lib/db/schema/org"
import { HttpError } from "./http"
import type { OrgScope } from "@/core/types/crm.types"

// Resolves the URL workspace slug to a system-actor scope for the token-gated
// machine API. Unknown slug is a 404 so a token holder cannot reach a workspace
// that does not exist, and every store call downstream is bound to this org.
export async function resolveOrgScope(orgSlug: string): Promise<OrgScope> {
  return (await resolveOrgIdentity(orgSlug)).scope
}

// Same lookup, plus the workspace's display name for surfaces that render it (the
// morning briefing heading).
export async function resolveOrgIdentity(
  orgSlug: string,
): Promise<{ scope: OrgScope; name: string }> {
  const rows = await db
    .select({ id: organizations.id, name: organizations.name })
    .from(organizations)
    .where(eq(organizations.slug, orgSlug))
    .limit(1)
  const org = rows[0]
  if (org === undefined) {
    throw new HttpError(404, `Workspace ${orgSlug} nebyl nalezen.`)
  }
  return { scope: { orgId: org.id, actor: { type: "system" } }, name: org.name }
}
