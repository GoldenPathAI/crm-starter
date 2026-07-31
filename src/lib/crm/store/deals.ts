import { differenceInCalendarDays, parseISO } from "date-fns";
import { and, asc, eq, max } from "drizzle-orm";
import { resolveDbc, withTx } from "@/lib/crm/store/db";
import { activities, clients, deals, projects } from "@/lib/db/schema/crm";
import { toDeal } from "@/lib/crm/store/mappers";
import { attachDealAssignees, getDealAssignees } from "@/lib/crm/store/assignees";
import { createProject } from "@/lib/crm/store/projects";
import { createTicket } from "@/lib/crm/store/tickets";
import { createNotification } from "@/lib/crm/store/notifications";
import {
  assertValidValue,
  getBySemantic,
  loadOrgEnums,
  type OrgEnums,
} from "@/lib/crm/enums/service";
import { getOrgSettings } from "@/lib/crm/store/org-settings";
import { WON_PROJECT_CHECKLIST } from "@/core/won-checklist";
import { todayIso } from "@/lib/dates";
import { normalizeOfferUrl } from "@/lib/crm/offer-url";
import { createId } from "@/lib/ids";
import type {
  Deal,
  DealStage,
  EnumOption,
  OrgMember,
  OrgScope,
  Project,
} from "@/core/types/crm.types";

const actorUserId = (scope: OrgScope): string | null =>
  scope.actor.type === "user" ? scope.actor.userId : null;

const activityActor = (
  scope: OrgScope,
): { actorType: "user" | "ai" | "system"; actorUserId: string | null } =>
  scope.actor.type === "user"
    ? { actorType: "user", actorUserId: scope.actor.userId }
    : { actorType: scope.actor.type, actorUserId: null };

const findStage = (enums: OrgEnums, value: string): EnumOption | undefined =>
  enums.deal_stage.find((option) => option.value === value);

const stageLabel = (enums: OrgEnums, value: string): string =>
  findStage(enums, value)?.label ?? value;

// Board grouping is derived from each option's stable semantic, never the value slug.
// Parked and the working stages are the open columns; parked is set aside so it never
// counts as stale.
const isOpenStage = (option: EnumOption): boolean =>
  option.semantic === "parked" || option.semantic === "open";

export interface DealCard extends Deal {
  clientName: string;
  daysInStage: number;
  isStale: boolean;
  closeDaysUntil?: number;
  assignees: OrgMember[];
}

export interface DealStageColumn {
  stage: DealStage;
  label: string;
  deals: DealCard[];
  count: number;
  sumCzk: number;
}

export async function listDealsByStage(scope: OrgScope): Promise<DealStageColumn[]> {
  const dbc = resolveDbc(scope);
  const [enums, settings, dealRows, clientRows] = await Promise.all([
    loadOrgEnums(scope.orgId),
    getOrgSettings(scope.orgId),
    dbc.select().from(deals).where(eq(deals.organizationId, scope.orgId)).orderBy(asc(deals.id)),
    dbc
      .select({ id: clients.id, name: clients.name })
      .from(clients)
      .where(eq(clients.organizationId, scope.orgId)),
  ]);
  const dealsAll = await attachDealAssignees(scope, dealRows.map(toDeal));
  const names = new Map(clientRows.map((row) => [row.id, row.name]));
  const today = parseISO(todayIso());

  return enums.deal_stage.map((option) => {
    const open = isOpenStage(option);
    const cards: DealCard[] = dealsAll
      .filter((deal) => deal.stage === option.value)
      .map((deal) => {
        const daysInStage = Math.max(
          0,
          differenceInCalendarDays(today, parseISO(deal.stageChangedAt)),
        );
        return {
          ...deal,
          clientName: names.get(deal.clientId) ?? deal.clientId,
          daysInStage,
          isStale: open && option.semantic === "open" && daysInStage > settings.staleDealDays,
          closeDaysUntil:
            deal.expectedClose !== undefined
              ? differenceInCalendarDays(parseISO(deal.expectedClose), today)
              : undefined,
        };
      })
      .sort((a, b) => a.order - b.order);
    return {
      stage: option.value,
      label: option.label,
      deals: cards,
      count: cards.length,
      sumCzk: cards.reduce((sum, deal) => sum + deal.valueCzk, 0),
    };
  });
}

export interface ClientOption {
  id: string;
  name: string;
}

export async function listClientOptions(scope: OrgScope): Promise<ClientOption[]> {
  const dbc = resolveDbc(scope);
  const rows = await dbc
    .select({ id: clients.id, name: clients.name })
    .from(clients)
    .where(eq(clients.organizationId, scope.orgId))
    .orderBy(asc(clients.name));
  return rows.map((row) => ({ id: row.id, name: row.name }));
}

export interface CreateDealInput {
  clientId: string;
  title: string;
  stage: DealStage;
  valueCzk: number;
  probability?: number;
  expectedClose?: string;
  nextStep?: string;
  description?: string;
}

export async function createDeal(scope: OrgScope, input: CreateDealInput): Promise<Deal> {
  await assertValidValue(scope.orgId, "deal_stage", input.stage);
  const enums = await loadOrgEnums(scope.orgId);
  const stageOption = findStage(enums, input.stage);
  const now = new Date();
  const dealId = createId("de");
  const probability = input.probability ?? stageOption?.defaultProbability ?? null;
  const dbc = resolveDbc(scope);

  const created = await withTx(dbc, async (tx) => {
    const clientRows = await tx
      .select({ id: clients.id })
      .from(clients)
      .where(and(eq(clients.id, input.clientId), eq(clients.organizationId, scope.orgId)))
      .limit(1);
    if (clientRows[0] === undefined) {
      throw new Error("Klient nebyl nalezen.");
    }
    const maxRow = await tx
      .select({ m: max(deals.order) })
      .from(deals)
      .where(and(eq(deals.stage, input.stage), eq(deals.organizationId, scope.orgId)));
    const nextOrder = (maxRow[0]?.m ?? -1) + 1;
    const rows = await tx
      .insert(deals)
      .values({
        id: dealId,
        organizationId: scope.orgId,
        clientId: input.clientId,
        title: input.title,
        stage: input.stage,
        order: nextOrder,
        valueCzk: input.valueCzk,
        probability,
        expectedClose: input.expectedClose ?? null,
        nextStep: input.nextStep ?? null,
        description: input.description ?? null,
        stageChangedAt: now,
        createdByUserId: actorUserId(scope),
        createdAt: now,
      })
      .returning();
    const row = rows[0];
    if (row === undefined) {
      throw new Error("Deal se nepodařilo vytvořit.");
    }
    await tx.insert(activities).values({
      id: createId("ac"),
      organizationId: scope.orgId,
      clientId: input.clientId,
      dealId,
      type: "system",
      title: `Deal vytvořen ve fázi ${stageLabel(enums, input.stage)}`,
      occurredAt: now,
      ...activityActor(scope),
    });
    return row;
  });

  return toDeal(created);
}

export interface UpdateDealInput {
  id: string;
  clientId?: string;
  title?: string;
  valueCzk?: number;
  probability?: number | null;
  expectedClose?: string | null;
  nextStep?: string | null;
  description?: string | null;
  lostReason?: string | null;
  offerUrl?: string | null;
}

// Partial update: only keys present in the input are written. A key set to null
// clears that column, undefined leaves it untouched. Stage transitions never go
// through here, they stay in moveDealStage so the system activity log stays truthful.
export async function updateDeal(scope: OrgScope, input: UpdateDealInput): Promise<Deal> {
  const patch: Partial<typeof deals.$inferInsert> = {
    ...(input.clientId !== undefined ? { clientId: input.clientId } : {}),
    ...(input.title !== undefined ? { title: input.title } : {}),
    ...(input.valueCzk !== undefined ? { valueCzk: input.valueCzk } : {}),
    ...(input.probability !== undefined ? { probability: input.probability } : {}),
    ...(input.expectedClose !== undefined ? { expectedClose: input.expectedClose } : {}),
    ...(input.nextStep !== undefined ? { nextStep: input.nextStep } : {}),
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(input.lostReason !== undefined ? { lostReason: input.lostReason } : {}),
    ...(input.offerUrl !== undefined
      ? {
          offerUrl: input.offerUrl,
          offerUrlNormalized: input.offerUrl === null ? null : normalizeOfferUrl(input.offerUrl),
        }
      : {}),
  };

  const dbc = resolveDbc(scope);
  const updated = await withTx(dbc, async (tx) => {
    const existing = await tx
      .select()
      .from(deals)
      .where(and(eq(deals.id, input.id), eq(deals.organizationId, scope.orgId)))
      .limit(1);
    const current = existing[0];
    if (current === undefined) {
      throw new Error("Deal nebyl nalezen.");
    }
    if (input.clientId !== undefined && input.clientId !== current.clientId) {
      const clientRows = await tx
        .select({ id: clients.id })
        .from(clients)
        .where(and(eq(clients.id, input.clientId), eq(clients.organizationId, scope.orgId)))
        .limit(1);
      if (clientRows[0] === undefined) {
        throw new Error("Klient nebyl nalezen.");
      }
    }
    if (Object.keys(patch).length === 0) {
      return current;
    }
    const rows = await tx
      .update(deals)
      .set(patch)
      .where(and(eq(deals.id, input.id), eq(deals.organizationId, scope.orgId)))
      .returning();
    const row = rows[0];
    if (row === undefined) {
      throw new Error("Deal nebyl nalezen.");
    }
    return row;
  });

  return toDeal(updated);
}

// Hard delete. projects.deal_id is FK with onDelete set null, so linked projects
// keep their row with a cleared reference. activities.deal_id is a soft text
// reference without an FK, its rows stay intact as historical log entries.
export async function deleteDeal(scope: OrgScope, dealId: string): Promise<void> {
  const dbc = resolveDbc(scope);
  const rows = await dbc
    .delete(deals)
    .where(and(eq(deals.id, dealId), eq(deals.organizationId, scope.orgId)))
    .returning({ id: deals.id });
  if (rows[0] === undefined) {
    throw new Error("Deal nebyl nalezen.");
  }
}

// The starting project status is the first non-terminal option: "open" is the default
// group, so the delivery project opens in whatever the org calls its first working
// column, never in the done semantic.
const defaultOpenProjectStatus = (enums: OrgEnums): string | undefined =>
  (enums.project_status.find((option) => option.semantic !== "done") ?? enums.project_status[0])
    ?.value;

// Checklist tickets carry the lowest priority (nothing is set as urgent up front); fall
// back to the last option in the ciselnik when no "low" semantic exists.
const defaultTicketPriority = (enums: OrgEnums): string | undefined => {
  const list = enums.ticket_priority;
  return (list.find((option) => option.semantic === "low") ?? list[list.length - 1] ?? list[0])
    ?.value;
};

// Winning a deal spins up its delivery project and the standard onboarding checklist in
// the SAME transaction as the stage change, so a win never lands without the follow-up
// work attached. Idempotent: a deal that already has a linked project (re-entering won,
// or a project created by hand) produces nothing and returns null.
async function createWonProject(
  scope: OrgScope,
  deal: typeof deals.$inferSelect,
  enums: OrgEnums,
): Promise<Project | null> {
  const dbc = resolveDbc(scope);
  const existing = await dbc
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.dealId, deal.id), eq(projects.organizationId, scope.orgId)))
    .limit(1);
  if (existing[0] !== undefined) {
    return null;
  }
  const status = defaultOpenProjectStatus(enums);
  const priority = defaultTicketPriority(enums);
  if (status === undefined || priority === undefined) {
    return null;
  }
  const project = await createProject(scope, {
    clientId: deal.clientId,
    name: deal.title,
    status,
    dealId: deal.id,
  });
  // Sequential so each ticket sees the previous one as a sibling and lands after it,
  // keeping the checklist in WON_PROJECT_CHECKLIST order on the board.
  for (const title of WON_PROJECT_CHECKLIST) {
    await createTicket(scope, { projectId: project.id, title, priority });
  }
  return project;
}

// Fired after the win transaction commits: one in-app notification per deal assignee.
async function notifyDealWon(scope: OrgScope, deal: typeof deals.$inferSelect): Promise<void> {
  const byDeal = await getDealAssignees(scope, [deal.id]);
  for (const member of byDeal[deal.id] ?? []) {
    await createNotification(scope, {
      userId: member.userId,
      type: "deal_won",
      title: `Deal vyhrán: ${deal.title}`,
      entityType: "deal",
      entityId: deal.id,
    });
  }
}

export async function moveDealStage(
  scope: OrgScope,
  dealId: string,
  stage: DealStage,
): Promise<Deal> {
  await assertValidValue(scope.orgId, "deal_stage", stage);
  const enums = await loadOrgEnums(scope.orgId);
  const lostStage = await getBySemantic(scope.orgId, "deal_stage", "lost");
  const stageOption = findStage(enums, stage);
  const changedAt = new Date();
  const probabilityPatch =
    stageOption?.defaultProbability !== undefined
      ? { probability: stageOption.defaultProbability }
      : {};

  const dbc = resolveDbc(scope);
  const { row: updated, wonProject } = await withTx(dbc, async (tx) => {
    const existing = await tx
      .select()
      .from(deals)
      .where(and(eq(deals.id, dealId), eq(deals.organizationId, scope.orgId)))
      .limit(1);
    const dealRow = existing[0];
    if (dealRow === undefined) {
      throw new Error("Deal nebyl nalezen.");
    }
    // Land the deal at the end of the target stage so it keeps a stable position.
    const maxRow = await tx
      .select({ m: max(deals.order) })
      .from(deals)
      .where(and(eq(deals.stage, stage), eq(deals.organizationId, scope.orgId)));
    const nextOrder = (maxRow[0]?.m ?? -1) + 1;
    // Reopening a deal out of the lost stage must drop its loss reason, otherwise the
    // detail view keeps rendering a phantom "Důvod prohry" with no path to clear it.
    const rows = await tx
      .update(deals)
      .set({
        stage,
        order: nextOrder,
        stageChangedAt: changedAt,
        ...probabilityPatch,
        ...(stage === lostStage.value ? {} : { lostReason: null }),
      })
      .where(and(eq(deals.id, dealId), eq(deals.organizationId, scope.orgId)))
      .returning();
    const row = rows[0];
    if (row === undefined) {
      throw new Error("Deal nebyl nalezen.");
    }
    await tx.insert(activities).values({
      id: createId("ac"),
      organizationId: scope.orgId,
      clientId: dealRow.clientId,
      dealId: dealRow.id,
      type: "system",
      title: `Fáze změněna na ${stageLabel(enums, stage)}`,
      occurredAt: changedAt,
      ...activityActor(scope),
    });
    const wonProject =
      stageOption?.semantic === "won"
        ? await createWonProject({ ...scope, db: tx }, row, enums)
        : null;
    return { row, wonProject };
  });

  if (wonProject !== null) {
    await notifyDealWon(scope, updated);
  }
  return toDeal(updated);
}

// Renumbers a whole stage column from orderedIds (used by the pipeline kanban's
// vertical drag-reorder). When the dragged deal lands in a different stage it also
// carries the stage-change side effects moveDealStage applies: stageChangedAt, the
// stage default probability, the system activity, and clearing a stale loss reason.
// Terminal stages (won, lost) go through moveDealStage via the win/loss dialogs, not
// this path.
export async function reorderDeal(
  scope: OrgScope,
  dealId: string,
  stage: DealStage,
  orderedIds: string[],
): Promise<Deal> {
  await assertValidValue(scope.orgId, "deal_stage", stage);
  const enums = await loadOrgEnums(scope.orgId);
  const lostStage = await getBySemantic(scope.orgId, "deal_stage", "lost");
  const stageOption = findStage(enums, stage);
  const changedAt = new Date();
  const probabilityPatch =
    stageOption?.defaultProbability !== undefined
      ? { probability: stageOption.defaultProbability }
      : {};
  const dbc = resolveDbc(scope);
  const updated = await withTx(dbc, async (tx) => {
    const existing = await tx
      .select()
      .from(deals)
      .where(and(eq(deals.id, dealId), eq(deals.organizationId, scope.orgId)))
      .limit(1);
    const current = existing[0];
    if (current === undefined) {
      throw new Error("Deal nebyl nalezen.");
    }
    const stageChanged = current.stage !== stage;
    let moved = current;
    for (let index = 0; index < orderedIds.length; index += 1) {
      const id = orderedIds[index];
      if (id === undefined) {
        continue;
      }
      const patch =
        id === dealId
          ? {
              order: index,
              stage,
              ...(stageChanged ? { stageChangedAt: changedAt, ...probabilityPatch } : {}),
              ...(stage === lostStage.value ? {} : { lostReason: null }),
            }
          : { order: index };
      const rows = await tx
        .update(deals)
        .set(patch)
        .where(and(eq(deals.id, id), eq(deals.organizationId, scope.orgId)))
        .returning();
      const row = rows[0];
      if (id === dealId && row !== undefined) {
        moved = row;
      }
    }
    if (stageChanged) {
      await tx.insert(activities).values({
        id: createId("ac"),
        organizationId: scope.orgId,
        clientId: current.clientId,
        dealId: current.id,
        type: "system",
        title: `Fáze změněna na ${stageLabel(enums, stage)}`,
        occurredAt: changedAt,
        ...activityActor(scope),
      });
    }
    return moved;
  });

  return toDeal(updated);
}
