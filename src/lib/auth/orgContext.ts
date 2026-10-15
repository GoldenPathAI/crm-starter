import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import type { OrgRole, OrgScope } from "@/core/types/crm.types";
import { hasPermission, roleAtLeast, type Permission } from "@/lib/auth/permissions";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db/client";
import { organizationMembers, organizations } from "@/lib/db/schema/org";

export type { OrgRole };

interface SessionUser {
  id: string;
  name: string;
  email: string;
}

export interface OrgContext {
  user: SessionUser;
  org: { id: string; slug: string; name: string };
  role: OrgRole;
  scope: OrgScope;
}

export type OrgContextResult =
  | { status: "ok"; context: OrgContext }
  | { status: "no-session" }
  | { status: "org-not-found" }
  | { status: "no-membership" };

export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (session === null) {
    return null;
  }

  return { id: session.user.id, name: session.user.name, email: session.user.email };
});

export const getOrgContext = cache(async (orgSlug: string): Promise<OrgContextResult> => {
  const user = await getSessionUser();
  if (user === null) {
    return { status: "no-session" };
  }

  const orgRows = await db
    .select({ id: organizations.id, slug: organizations.slug, name: organizations.name })
    .from(organizations)
    .where(eq(organizations.slug, orgSlug))
    .limit(1);
  const org = orgRows[0];
  if (org === undefined) {
    return { status: "org-not-found" };
  }

  const memberRows = await db
    .select({ role: organizationMembers.role })
    .from(organizationMembers)
    .where(
      and(eq(organizationMembers.organizationId, org.id), eq(organizationMembers.userId, user.id)),
    )
    .limit(1);
  const member = memberRows[0];
  if (member === undefined) {
    return { status: "no-membership" };
  }

  return {
    status: "ok",
    context: {
      user,
      org,
      role: member.role,
      scope: { orgId: org.id, actor: { type: "user", userId: user.id } },
    },
  };
});

export async function requireOrgContext(orgSlug: string): Promise<OrgContext> {
  const result = await getOrgContext(orgSlug);
  if (result.status === "no-session") {
    redirect("/login");
  }

  if (result.status === "org-not-found") {
    notFound();
  }

  if (result.status === "no-membership") {
    redirect("/no-access");
  }

  return result.context;
}

export function requireRole(ctx: OrgContext, minRole: OrgRole): void {
  if (!roleAtLeast(ctx.role, minRole)) {
    throw new Error("Na tuto akci nemáš dostatečné oprávnění.");
  }
}

export function requirePermission(ctx: OrgContext, permission: Permission): void {
  if (!hasPermission(ctx.role, permission)) {
    redirect("/no-access?reason=permission");
  }
}
