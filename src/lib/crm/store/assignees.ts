import { and, asc, eq, inArray } from "drizzle-orm"
import type { OrgMember, OrgScope } from "@/core/types/crm.types"
import { db } from "@/lib/db/client"
import { resolveDbc, withTx } from "@/lib/crm/store/db"
import { notifyAssignment } from "@/lib/crm/store/notifications"
import { users } from "@/lib/db/schema/auth"
import { dealAssignees, deals, ticketAssignees, tickets } from "@/lib/db/schema/crm"
import { organizationMembers } from "@/lib/db/schema/org"
import { createId } from "@/lib/ids"

// The user performing the assignment never notifies themselves for adding their own name.
const actingUserId = (scope: OrgScope): string | undefined =>
  scope.actor.type === "user" ? scope.actor.userId : undefined

interface KeyedMember {
  key: string
  member: OrgMember
}

const groupByKey = (rows: KeyedMember[]): Record<string, OrgMember[]> =>
  rows.reduce<Record<string, OrgMember[]>>(
    (acc, { key, member }) => ({ ...acc, [key]: [...(acc[key] ?? []), member] }),
    {},
  )

const uniqueIds = (ids: string[]): string[] => [...new Set(ids)]

async function assertOrgMembers(orgId: string, userIds: string[]): Promise<void> {
  if (userIds.length === 0) {
    return
  }

  const rows = await db
    .select({ userId: organizationMembers.userId })
    .from(organizationMembers)
    .where(and(eq(organizationMembers.organizationId, orgId), inArray(organizationMembers.userId, userIds)))
  const memberIds = new Set(rows.map((row) => row.userId))
  if (userIds.some((id) => !memberIds.has(id))) {
    throw new Error("Uživatel není členem organizace.")
  }
}

export async function getTicketAssignees(
  scope: OrgScope,
  ticketIds: string[],
): Promise<Record<string, OrgMember[]>> {
  if (ticketIds.length === 0) {
    return {}
  }

  const dbc = resolveDbc(scope)
  const rows = await dbc
    .select({
      key: ticketAssignees.ticketId,
      userId: users.id,
      name: users.name,
      email: users.email,
      role: organizationMembers.role,
      joinedAt: organizationMembers.createdAt,
    })
    .from(ticketAssignees)
    .innerJoin(tickets, eq(ticketAssignees.ticketId, tickets.id))
    .innerJoin(users, eq(ticketAssignees.userId, users.id))
    .innerJoin(
      organizationMembers,
      and(eq(organizationMembers.userId, users.id), eq(organizationMembers.organizationId, scope.orgId)),
    )
    .where(and(inArray(ticketAssignees.ticketId, ticketIds), eq(tickets.organizationId, scope.orgId)))
    .orderBy(asc(users.name))

  return groupByKey(
    rows.map((row) => ({
      key: row.key,
      member: {
        userId: row.userId,
        name: row.name,
        email: row.email,
        role: row.role,
        joinedAt: row.joinedAt.toISOString(),
      },
    })),
  )
}

// Adds an `assignees` array to each ticket/deal-like row using a single bulk read,
// so list and board surfaces never issue one assignee query per row.
export async function attachTicketAssignees<T extends { id: string }>(
  scope: OrgScope,
  rows: T[],
): Promise<(T & { assignees: OrgMember[] })[]> {
  const byTicket = await getTicketAssignees(scope, rows.map((row) => row.id))

  return rows.map((row) => ({ ...row, assignees: byTicket[row.id] ?? [] }))
}

export async function attachDealAssignees<T extends { id: string }>(
  scope: OrgScope,
  rows: T[],
): Promise<(T & { assignees: OrgMember[] })[]> {
  const byDeal = await getDealAssignees(scope, rows.map((row) => row.id))

  return rows.map((row) => ({ ...row, assignees: byDeal[row.id] ?? [] }))
}

export async function setTicketAssignees(
  scope: OrgScope,
  ticketId: string,
  userIds: string[],
): Promise<void> {
  const dbc = resolveDbc(scope)
  const ticketRows = await dbc
    .select({ id: tickets.id, title: tickets.title })
    .from(tickets)
    .where(and(eq(tickets.id, ticketId), eq(tickets.organizationId, scope.orgId)))
    .limit(1)
  const ticket = ticketRows[0]
  if (ticket === undefined) {
    throw new Error("Úkol nebyl nalezen.")
  }

  const targets = uniqueIds(userIds)
  await assertOrgMembers(scope.orgId, targets)

  const added = await withTx(dbc, async (tx) => {
    const current = await tx
      .select({ userId: ticketAssignees.userId })
      .from(ticketAssignees)
      .where(eq(ticketAssignees.ticketId, ticketId))
    const currentIds = new Set(current.map((row) => row.userId))
    const targetSet = new Set(targets)
    const toRemove = [...currentIds].filter((id) => !targetSet.has(id))
    const toAdd = targets.filter((id) => !currentIds.has(id))
    if (toRemove.length > 0) {
      await tx
        .delete(ticketAssignees)
        .where(and(eq(ticketAssignees.ticketId, ticketId), inArray(ticketAssignees.userId, toRemove)))
    }

    if (toAdd.length > 0) {
      await tx.insert(ticketAssignees).values(toAdd.map((userId) => ({ id: createId("ta"), ticketId, userId })))
    }

    return toAdd
  })

  const actor = actingUserId(scope)
  await notifyAssignment(scope, {
    recipientUserIds: added.filter((id) => id !== actor),
    type: "ticket_assigned",
    entityType: "ticket",
    entityId: ticketId,
    entityTitle: ticket.title,
  })
}

export async function getDealAssignees(
  scope: OrgScope,
  dealIds: string[],
): Promise<Record<string, OrgMember[]>> {
  if (dealIds.length === 0) {
    return {}
  }

  const dbc = resolveDbc(scope)
  const rows = await dbc
    .select({
      key: dealAssignees.dealId,
      userId: users.id,
      name: users.name,
      email: users.email,
      role: organizationMembers.role,
      joinedAt: organizationMembers.createdAt,
    })
    .from(dealAssignees)
    .innerJoin(deals, eq(dealAssignees.dealId, deals.id))
    .innerJoin(users, eq(dealAssignees.userId, users.id))
    .innerJoin(
      organizationMembers,
      and(eq(organizationMembers.userId, users.id), eq(organizationMembers.organizationId, scope.orgId)),
    )
    .where(and(inArray(dealAssignees.dealId, dealIds), eq(deals.organizationId, scope.orgId)))
    .orderBy(asc(users.name))

  return groupByKey(
    rows.map((row) => ({
      key: row.key,
      member: {
        userId: row.userId,
        name: row.name,
        email: row.email,
        role: row.role,
        joinedAt: row.joinedAt.toISOString(),
      },
    })),
  )
}

export async function setDealAssignees(
  scope: OrgScope,
  dealId: string,
  userIds: string[],
): Promise<void> {
  const dbc = resolveDbc(scope)
  const dealRows = await dbc
    .select({ id: deals.id, title: deals.title })
    .from(deals)
    .where(and(eq(deals.id, dealId), eq(deals.organizationId, scope.orgId)))
    .limit(1)
  const deal = dealRows[0]
  if (deal === undefined) {
    throw new Error("Deal nebyl nalezen.")
  }

  const targets = uniqueIds(userIds)
  await assertOrgMembers(scope.orgId, targets)

  const added = await withTx(dbc, async (tx) => {
    const current = await tx
      .select({ userId: dealAssignees.userId })
      .from(dealAssignees)
      .where(eq(dealAssignees.dealId, dealId))
    const currentIds = new Set(current.map((row) => row.userId))
    const targetSet = new Set(targets)
    const toRemove = [...currentIds].filter((id) => !targetSet.has(id))
    const toAdd = targets.filter((id) => !currentIds.has(id))
    if (toRemove.length > 0) {
      await tx
        .delete(dealAssignees)
        .where(and(eq(dealAssignees.dealId, dealId), inArray(dealAssignees.userId, toRemove)))
    }

    if (toAdd.length > 0) {
      await tx.insert(dealAssignees).values(toAdd.map((userId) => ({ id: createId("da"), dealId, userId })))
    }

    return toAdd
  })

  const actor = actingUserId(scope)
  await notifyAssignment(scope, {
    recipientUserIds: added.filter((id) => id !== actor),
    type: "deal_assigned",
    entityType: "deal",
    entityId: dealId,
    entityTitle: deal.title,
  })
}
