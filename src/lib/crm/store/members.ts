import { and, asc, desc, eq, inArray } from "drizzle-orm"
import type { OrgMember, OrgRole } from "@/core/types/crm.types"
import { db } from "@/lib/db/client"
import { users } from "@/lib/db/schema/auth"
import { organizationInvitations, organizationMembers, organizations } from "@/lib/db/schema/org"

// Bulk name lookup for actor hydration. Users are global (not org-scoped), so this
// takes plain ids and returns a name-by-id map; callers attach the label themselves.
export async function userNamesByIds(ids: readonly string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids)]
  if (unique.length === 0) {
    return new Map()
  }

  const rows = await db
    .select({ id: users.id, name: users.name })
    .from(users)
    .where(inArray(users.id, unique))

  return new Map(rows.map((row) => [row.id, row.name]))
}

export interface UserMembership {
  orgId: string
  slug: string
  name: string
  role: OrgRole
}

export async function listUserMemberships(userId: string): Promise<UserMembership[]> {
  const rows = await db
    .select({
      orgId: organizations.id,
      slug: organizations.slug,
      name: organizations.name,
      role: organizationMembers.role,
    })
    .from(organizationMembers)
    .innerJoin(organizations, eq(organizationMembers.organizationId, organizations.id))
    .where(eq(organizationMembers.userId, userId))
    .orderBy(asc(organizations.name))

  return rows
}

export async function listOrgMembers(orgId: string): Promise<OrgMember[]> {
  const rows = await db
    .select({
      userId: users.id,
      name: users.name,
      email: users.email,
      role: organizationMembers.role,
      joinedAt: organizationMembers.createdAt,
    })
    .from(organizationMembers)
    .innerJoin(users, eq(organizationMembers.userId, users.id))
    .where(eq(organizationMembers.organizationId, orgId))
    .orderBy(asc(users.name))

  return rows.map((row) => ({
    userId: row.userId,
    name: row.name,
    email: row.email,
    role: row.role,
    joinedAt: row.joinedAt.toISOString(),
  }))
}

export interface SettingsMember {
  memberId: string
  userId: string
  name: string
  email: string
  role: OrgRole
  joinedAt: string
}

export async function listSettingsMembers(orgId: string): Promise<SettingsMember[]> {
  const rows = await db
    .select({
      memberId: organizationMembers.id,
      userId: users.id,
      name: users.name,
      email: users.email,
      role: organizationMembers.role,
      joinedAt: organizationMembers.createdAt,
    })
    .from(organizationMembers)
    .innerJoin(users, eq(organizationMembers.userId, users.id))
    .where(eq(organizationMembers.organizationId, orgId))
    .orderBy(asc(users.name))

  return rows.map((row) => ({
    memberId: row.memberId,
    userId: row.userId,
    name: row.name,
    email: row.email,
    role: row.role,
    joinedAt: row.joinedAt.toISOString(),
  }))
}

export interface PendingInvitation {
  id: string
  email: string
  role: OrgRole
  createdAt: string
  expiresAt?: string
  inviterName?: string
}

export async function listPendingInvitations(orgId: string): Promise<PendingInvitation[]> {
  const rows = await db
    .select({
      id: organizationInvitations.id,
      email: organizationInvitations.email,
      role: organizationInvitations.role,
      createdAt: organizationInvitations.createdAt,
      expiresAt: organizationInvitations.expiresAt,
      inviterName: users.name,
    })
    .from(organizationInvitations)
    .leftJoin(users, eq(organizationInvitations.inviterId, users.id))
    .where(
      and(
        eq(organizationInvitations.organizationId, orgId),
        eq(organizationInvitations.status, "pending"),
      ),
    )
    .orderBy(desc(organizationInvitations.createdAt))

  return rows.map((row) => ({
    id: row.id,
    email: row.email,
    role: row.role,
    createdAt: row.createdAt.toISOString(),
    expiresAt: row.expiresAt?.toISOString(),
    inviterName: row.inviterName ?? undefined,
  }))
}

export interface InvitationForAcceptance {
  id: string
  email: string
  role: OrgRole
  status: string
  expiresAt?: string
  orgId: string
  orgSlug: string
  orgName: string
}

export async function getInvitationForAcceptance(
  invitationId: string,
): Promise<InvitationForAcceptance | null> {
  const rows = await db
    .select({
      id: organizationInvitations.id,
      email: organizationInvitations.email,
      role: organizationInvitations.role,
      status: organizationInvitations.status,
      expiresAt: organizationInvitations.expiresAt,
      orgId: organizations.id,
      orgSlug: organizations.slug,
      orgName: organizations.name,
    })
    .from(organizationInvitations)
    .innerJoin(organizations, eq(organizationInvitations.organizationId, organizations.id))
    .where(eq(organizationInvitations.id, invitationId))
    .limit(1)
  const row = rows[0]
  if (row === undefined) {
    return null
  }

  return {
    id: row.id,
    email: row.email,
    role: row.role,
    status: row.status,
    expiresAt: row.expiresAt?.toISOString(),
    orgId: row.orgId,
    orgSlug: row.orgSlug,
    orgName: row.orgName,
  }
}

export function ownerCount(members: Pick<SettingsMember, "role">[]): number {
  return members.filter((member) => member.role === "owner").length
}

export function isLastOwnerRemoval(members: SettingsMember[], memberId: string): boolean {
  const target = members.find((member) => member.memberId === memberId)
  if (target?.role !== "owner") {
    return false
  }

  return ownerCount(members) === 1
}

export function isLastOwnerDemotion(
  members: SettingsMember[],
  memberId: string,
  nextRole: OrgRole,
): boolean {
  const target = members.find((member) => member.memberId === memberId)
  if (target?.role !== "owner" || nextRole === "owner") {
    return false
  }

  return ownerCount(members) === 1
}
