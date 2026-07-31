import { eq } from "drizzle-orm"
import type { OrgScope } from "@/core/types/crm.types"
import { db } from "@/lib/db/client"
import { organizations } from "@/lib/db/schema/org"

export interface OrgIdentity {
  id: string
  slug: string
  name: string
}

// Slug to org lookup used by scripts before an OrgScope exists. Returns null so the
// caller decides whether a missing workspace is an error (seed/wipe) or a fresh start.
export async function getOrgBySlug(slug: string): Promise<OrgIdentity | null> {
  const rows = await db
    .select({ id: organizations.id, slug: organizations.slug, name: organizations.name })
    .from(organizations)
    .where(eq(organizations.slug, slug))
    .limit(1)
  return rows[0] ?? null
}

export async function updateOrganizationName(scope: OrgScope, name: string): Promise<void> {
  const trimmed = name.trim()
  if (trimmed.length === 0) {
    throw new Error("Název organizace nesmí být prázdný.")
  }
  await db
    .update(organizations)
    .set({ name: trimmed, updatedAt: new Date() })
    .where(eq(organizations.id, scope.orgId))
}
