"use server";

import { revalidatePath } from "next/cache";
import { reorderTicket, updateTicketStatus } from "@/lib/crm/store/tickets";
import { deleteProject, updateProject, updateProjectStatus } from "@/lib/crm/store/projects";
import { requireOrgContext } from "@/lib/auth/orgContext";
import { orgHref } from "@/lib/nav";
import { withUiAudit } from "@/app/_lib/auditedAction";
import type { ActionState } from "@/app/_lib/actionState";

const revalidateTicketViews = (orgSlug: string, projectId: string): void => {
  revalidatePath(orgHref(orgSlug, `/projekty/${projectId}`));
  revalidatePath(orgHref(orgSlug, "/projekty"));
  revalidatePath(orgHref(orgSlug, "/ukoly"));
};

const optionalText = (value: string): string | undefined => {
  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : undefined;
};

export async function changeTicketStatusAction(
  orgSlug: string,
  input: {
    ticketId: string;
    status: string;
    projectId: string;
  },
): Promise<ActionState> {
  const ctx = await requireOrgContext(orgSlug);
  try {
    await withUiAudit(ctx, (scope) => updateTicketStatus(scope, input.ticketId, input.status));
    revalidateTicketViews(orgSlug, input.projectId);

    return { status: "success", message: "Stav úkolu byl změněn." };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Stav úkolu se nepodařilo změnit.",
    };
  }
}

export async function reorderTicketAction(
  orgSlug: string,
  input: {
    ticketId: string;
    status: string;
    orderedIds: string[];
    projectId: string;
  },
): Promise<ActionState> {
  const ctx = await requireOrgContext(orgSlug);
  try {
    await withUiAudit(ctx, (scope) =>
      reorderTicket(scope, input.ticketId, input.status, input.orderedIds),
    );
    revalidateTicketViews(orgSlug, input.projectId);

    return { status: "success", message: "Pořadí úkolů bylo uloženo." };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Pořadí úkolů se nepodařilo uložit.",
    };
  }
}

interface ProjectWritePayload {
  projectId: string;
  clientId: string;
  name: string;
  description: string;
  status: string;
  startedAt: string;
  dueAt: string;
  budgetCzk: number | null;
}

export async function updateProjectAction(
  orgSlug: string,
  input: ProjectWritePayload,
): Promise<ActionState> {
  const ctx = await requireOrgContext(orgSlug);
  if (input.name.trim().length === 0) {
    return { status: "error", message: "Vyplňte název projektu." };
  }

  if (input.clientId.length === 0) {
    return { status: "error", message: "Vyberte klienta." };
  }

  try {
    const project = await withUiAudit(ctx, (scope) =>
      updateProject(scope, input.projectId, {
        clientId: input.clientId,
        name: input.name.trim(),
        description: optionalText(input.description),
        status: input.status,
        startedAt: optionalText(input.startedAt),
        dueAt: optionalText(input.dueAt),
        budgetCzk: input.budgetCzk ?? undefined,
      }),
    );
    revalidatePath(orgHref(orgSlug, `/projekty/${project.id}`));
    revalidatePath(orgHref(orgSlug, "/projekty"));
    revalidatePath(orgHref(orgSlug, "/ukoly"));
    revalidatePath(orgHref(orgSlug, `/klienti/${project.clientId}`));

    return { status: "success", message: "Projekt byl uložen." };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Projekt se nepodařilo uložit.",
    };
  }
}

export async function changeProjectStatusAction(
  orgSlug: string,
  input: {
    projectId: string;
    status: string;
  },
): Promise<ActionState> {
  const ctx = await requireOrgContext(orgSlug);
  try {
    const project = await withUiAudit(ctx, (scope) =>
      updateProjectStatus(scope, input.projectId, input.status),
    );
    revalidatePath(orgHref(orgSlug, `/projekty/${project.id}`));
    revalidatePath(orgHref(orgSlug, "/projekty"));
    revalidatePath(orgHref(orgSlug, `/klienti/${project.clientId}`));

    return { status: "success", message: "Stav projektu byl změněn." };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Stav projektu se nepodařilo změnit.",
    };
  }
}

export async function deleteProjectAction(
  orgSlug: string,
  input: {
    projectId: string;
  },
): Promise<ActionState> {
  const ctx = await requireOrgContext(orgSlug);
  try {
    const requestId = await withUiAudit(ctx, async (scope, reqId) => {
      await deleteProject(scope, input.projectId);

      return reqId;
    });
    revalidatePath(orgHref(orgSlug, "/projekty"));
    revalidatePath(orgHref(orgSlug, "/ukoly"));

    return { status: "success", message: "Projekt byl smazán.", requestId };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Projekt se nepodařilo smazat.",
    };
  }
}
