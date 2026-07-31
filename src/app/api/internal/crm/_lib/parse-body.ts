import { HttpError, asBoolean, asNumber, asStringArray, asTrimmed, isRecord } from "./http";
import type { OrgEnums } from "@/lib/crm/enums/service";
import type {
  ClientContactInput,
  CreateClientInput,
  UpdateClientPatch,
} from "@/lib/crm/store/clients";
import type { CreateDealInput, UpdateDealInput } from "@/lib/crm/store/deals";
import type { CreateProjectInput, UpdateProjectInput } from "@/lib/crm/store/projects";
import type { CreateTicketInput, UpdateTicketInput } from "@/lib/crm/store/tickets";
import type { CreatePersonInput, UpdatePersonInput } from "@/lib/crm/store/people";
import type { CreateRapportEntryInput } from "@/lib/crm/store/rapport";
import type { CreateDocumentInput, DocumentInput } from "@/lib/crm/store/documents";
import type { AddActivityInput } from "@/lib/crm/store/activities";
import { isTicketRecurrence } from "@/core/types/crm.types";
import type { Doc, EnumKind, Project, Ticket, TicketRecurrence } from "@/core/types/crm.types";

type Body = Record<string, unknown>;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const present = (body: Body, key: string): boolean =>
  key in body && body[key] !== null && body[key] !== undefined;

const isExplicitNull = (body: Body, key: string): boolean => key in body && body[key] === null;

const requireText = (body: Body, key: string): string => {
  const value = asTrimmed(body[key]);
  if (value === undefined) {
    throw new HttpError(400, `Pole ${key} je povinné.`);
  }
  return value;
};

const optionalText = (body: Body, key: string): string | undefined => {
  if (!present(body, key)) {
    return undefined;
  }
  const value = asTrimmed(body[key]);
  if (value === undefined) {
    throw new HttpError(400, `Pole ${key} musí být neprázdný text.`);
  }
  return value;
};

// Distinguishes absent (undefined -> leave), explicit null (clear) and a value.
const nullableText = (body: Body, key: string): string | null | undefined => {
  if (isExplicitNull(body, key)) {
    return null;
  }
  return optionalText(body, key);
};

interface NumberBounds {
  min?: number;
  max?: number;
}

// Mirrors the numeric guards the UI actions enforce so the token-gated machine API
// cannot write out-of-range values (negative deal value, probability outside 0-100).
const enforceBounds = (value: number, key: string, bounds: NumberBounds | undefined): number => {
  if (bounds?.min !== undefined && value < bounds.min) {
    throw new HttpError(400, `Pole ${key} musí být větší nebo rovno ${bounds.min}.`);
  }
  if (bounds?.max !== undefined && value > bounds.max) {
    throw new HttpError(400, `Pole ${key} musí být menší nebo rovno ${bounds.max}.`);
  }
  return value;
};

const requireNumber = (body: Body, key: string, bounds?: NumberBounds): number => {
  const value = asNumber(body[key]);
  if (value === undefined) {
    throw new HttpError(400, `Pole ${key} musí být číslo.`);
  }
  return enforceBounds(value, key, bounds);
};

const optionalNumber = (body: Body, key: string, bounds?: NumberBounds): number | undefined => {
  if (!present(body, key)) {
    return undefined;
  }
  return requireNumber(body, key, bounds);
};

const nullableNumber = (
  body: Body,
  key: string,
  bounds?: NumberBounds,
): number | null | undefined => {
  if (isExplicitNull(body, key)) {
    return null;
  }
  return optionalNumber(body, key, bounds);
};

const parseDate = (value: string, key: string): string => {
  if (!DATE_RE.test(value)) {
    throw new HttpError(400, `Pole ${key} musí být datum ve formátu YYYY-MM-DD.`);
  }
  // The pattern alone accepts impossible dates (2026-13-40). Round-trip through a
  // UTC Date so the store never receives a value Postgres will reject at write time.
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new HttpError(400, `Pole ${key} musí být platné datum ve formátu YYYY-MM-DD.`);
  }
  return value;
};

const optionalDate = (body: Body, key: string): string | undefined => {
  const value = optionalText(body, key);
  return value === undefined ? undefined : parseDate(value, key);
};

const nullableDate = (body: Body, key: string): string | null | undefined => {
  if (isExplicitNull(body, key)) {
    return null;
  }
  return optionalDate(body, key);
};

// Enum values are validated against the org's loaded options, not a static list.
// Domain enum types are plain string aliases, so a value confirmed to be a real option
// for this org passes straight through to the store with no cast.
const inOrgEnum = (enums: OrgEnums, kind: EnumKind, value: string): boolean =>
  enums[kind].some((option) => option.value === value);

const requireOrgEnum = (body: Body, key: string, enums: OrgEnums, kind: EnumKind): string => {
  const value = asTrimmed(body[key]);
  if (value === undefined || !inOrgEnum(enums, kind, value)) {
    throw new HttpError(400, `Pole ${key} má neplatnou hodnotu.`);
  }
  return value;
};

const optionalOrgEnum = (
  body: Body,
  key: string,
  enums: OrgEnums,
  kind: EnumKind,
): string | undefined => {
  if (!present(body, key)) {
    return undefined;
  }
  return requireOrgEnum(body, key, enums, kind);
};

const requireOrgEnumList = (body: Body, key: string, enums: OrgEnums, kind: EnumKind): string[] => {
  const raw = asStringArray(body[key]);
  if (raw === undefined) {
    throw new HttpError(400, `Pole ${key} musí být pole platných hodnot.`);
  }
  const values = raw.map((entry) => entry.trim()).filter((entry) => entry.length > 0);
  if (!values.every((value) => inOrgEnum(enums, kind, value))) {
    throw new HttpError(400, `Pole ${key} musí být pole platných hodnot.`);
  }
  return values;
};

const optionalOrgEnumList = (
  body: Body,
  key: string,
  enums: OrgEnums,
  kind: EnumKind,
): string[] | undefined => {
  if (!present(body, key)) {
    return undefined;
  }
  return requireOrgEnumList(body, key, enums, kind);
};

const requireBoolean = (body: Body, key: string): boolean => {
  const value = asBoolean(body[key]);
  if (value === undefined) {
    throw new HttpError(400, `Pole ${key} musí být true nebo false.`);
  }
  return value;
};

const optionalBoolean = (body: Body, key: string): boolean | undefined => {
  if (!present(body, key)) {
    return undefined;
  }
  return requireBoolean(body, key);
};

const optionalStringList = (body: Body, key: string): string[] | undefined => {
  if (!present(body, key)) {
    return undefined;
  }
  const value = asStringArray(body[key]);
  if (value === undefined) {
    throw new HttpError(400, `Pole ${key} musí být pole textů.`);
  }
  return value.map((entry) => entry.trim()).filter((entry) => entry.length > 0);
};

// Merge helpers for full-replace store updates: absent key keeps current,
// explicit null clears (-> undefined so the store writes null), value sets.
const mergeText = (body: Body, key: string, current: string | undefined): string | undefined => {
  if (!(key in body)) {
    return current;
  }
  if (body[key] === null) {
    return undefined;
  }
  const value = asTrimmed(body[key]);
  if (value === undefined) {
    throw new HttpError(400, `Pole ${key} musí být neprázdný text.`);
  }
  return value;
};

const mergeDate = (body: Body, key: string, current: string | undefined): string | undefined => {
  const merged = mergeText(body, key, current);
  return merged === undefined ? undefined : parseDate(merged, key);
};

const mergeNumber = (
  body: Body,
  key: string,
  current: number | undefined,
  bounds?: NumberBounds,
): number | undefined => {
  if (!(key in body)) {
    return current;
  }
  if (body[key] === null) {
    return undefined;
  }
  return requireNumber(body, key, bounds);
};

// Recurrence is a fixed code-level union, not an org ciselnik, so it validates
// against the TICKET_RECURRENCE_VALUES guard instead of the org's enum options.
const optionalRecurrence = (body: Body, key: string): TicketRecurrence | undefined => {
  if (!present(body, key)) {
    return undefined;
  }
  const value = asTrimmed(body[key]);
  if (value === undefined || !isTicketRecurrence(value)) {
    throw new HttpError(400, `Pole ${key} má neplatnou hodnotu.`);
  }
  return value;
};

const mergeRecurrence = (
  body: Body,
  key: string,
  current: TicketRecurrence | undefined,
): TicketRecurrence | null => {
  if (!(key in body)) {
    return current ?? null;
  }
  if (body[key] === null) {
    return null;
  }
  return optionalRecurrence(body, key) ?? null;
};

const requireContact = (value: unknown): ClientContactInput | undefined => {
  if (value === null || value === undefined) {
    return undefined;
  }
  if (!isRecord(value)) {
    throw new HttpError(400, "Pole primaryContact musí být objekt.");
  }
  return {
    name: requireText(value, "name"),
    role: optionalText(value, "role"),
    email: optionalText(value, "email"),
    phone: optionalText(value, "phone"),
  };
};

export const parseCreateClient = (body: Body, enums: OrgEnums): CreateClientInput => ({
  name: requireText(body, "name"),
  industry: requireText(body, "industry"),
  status: requireOrgEnum(body, "status", enums, "client_status"),
  services: requireOrgEnumList(body, "services", enums, "service_kind"),
  street: optionalText(body, "street"),
  city: optionalText(body, "city"),
  zip: optionalText(body, "zip"),
  ico: optionalText(body, "ico"),
  dic: optionalText(body, "dic"),
  website: optionalText(body, "website"),
  billingEmail: optionalText(body, "billingEmail"),
  mrrCzk: optionalNumber(body, "mrrCzk"),
  nextStep: optionalText(body, "nextStep"),
  note: optionalText(body, "note"),
  labels: optionalStringList(body, "labels"),
  primaryContact: requireContact(body.primaryContact),
});

export const parseUpdateClient = (body: Body, enums: OrgEnums): UpdateClientPatch => ({
  name: optionalText(body, "name"),
  industry: optionalText(body, "industry"),
  street: nullableText(body, "street"),
  city: nullableText(body, "city"),
  zip: nullableText(body, "zip"),
  ico: nullableText(body, "ico"),
  dic: nullableText(body, "dic"),
  website: nullableText(body, "website"),
  status: optionalOrgEnum(body, "status", enums, "client_status"),
  services: optionalOrgEnumList(body, "services", enums, "service_kind"),
  billingEmail: nullableText(body, "billingEmail"),
  mrrCzk: nullableNumber(body, "mrrCzk"),
  nextStep: nullableText(body, "nextStep"),
  note: nullableText(body, "note"),
  labels: optionalStringList(body, "labels"),
});

export const parseCreateDeal = (body: Body, enums: OrgEnums): CreateDealInput => ({
  clientId: requireText(body, "clientId"),
  title: requireText(body, "title"),
  stage: requireOrgEnum(body, "stage", enums, "deal_stage"),
  valueCzk: requireNumber(body, "valueCzk", { min: 0 }),
  probability: optionalNumber(body, "probability", { min: 0, max: 100 }),
  expectedClose: optionalDate(body, "expectedClose"),
  nextStep: optionalText(body, "nextStep"),
  description: optionalText(body, "description"),
});

export const parseUpdateDeal = (id: string, body: Body): UpdateDealInput => {
  if ("stage" in body) {
    throw new HttpError(400, "Fázi dealu měň přes POST /deals/{id}/move.");
  }
  return {
    id,
    clientId: optionalText(body, "clientId"),
    title: optionalText(body, "title"),
    valueCzk: optionalNumber(body, "valueCzk", { min: 0 }),
    probability: nullableNumber(body, "probability", { min: 0, max: 100 }),
    expectedClose: nullableDate(body, "expectedClose"),
    nextStep: nullableText(body, "nextStep"),
    description: nullableText(body, "description"),
    lostReason: nullableText(body, "lostReason"),
    offerUrl: nullableText(body, "offerUrl"),
  };
};

export const parseCreateProject = (body: Body, enums: OrgEnums): CreateProjectInput => ({
  clientId: requireText(body, "clientId"),
  name: requireText(body, "name"),
  status: requireOrgEnum(body, "status", enums, "project_status"),
  description: optionalText(body, "description"),
  startedAt: optionalDate(body, "startedAt"),
  dueAt: optionalDate(body, "dueAt"),
  budgetCzk: optionalNumber(body, "budgetCzk"),
  dealId: optionalText(body, "dealId"),
});

export const parseUpdateProject = (
  current: Project,
  body: Body,
  enums: OrgEnums,
): UpdateProjectInput => ({
  clientId: optionalText(body, "clientId") ?? current.clientId,
  name: optionalText(body, "name") ?? current.name,
  status: optionalOrgEnum(body, "status", enums, "project_status") ?? current.status,
  description: mergeText(body, "description", current.description),
  startedAt: mergeDate(body, "startedAt", current.startedAt),
  dueAt: mergeDate(body, "dueAt", current.dueAt),
  budgetCzk: mergeNumber(body, "budgetCzk", current.budgetCzk),
});

export const parseCreateTicket = (body: Body, enums: OrgEnums): CreateTicketInput => ({
  clientId: optionalText(body, "clientId"),
  projectId: optionalText(body, "projectId"),
  dealId: optionalText(body, "dealId"),
  title: requireText(body, "title"),
  priority: requireOrgEnum(body, "priority", enums, "ticket_priority"),
  status: optionalOrgEnum(body, "status", enums, "ticket_status"),
  description: optionalText(body, "description"),
  dueAt: optionalDate(body, "dueAt"),
  labels: optionalStringList(body, "labels"),
  recurrence: optionalRecurrence(body, "recurrence"),
  parentId: optionalText(body, "parentId"),
});

export const parseUpdateTicket = (
  current: Ticket,
  body: Body,
  enums: OrgEnums,
): UpdateTicketInput => ({
  title: optionalText(body, "title") ?? current.title,
  priority: optionalOrgEnum(body, "priority", enums, "ticket_priority") ?? current.priority,
  status: optionalOrgEnum(body, "status", enums, "ticket_status") ?? current.status,
  description: mergeText(body, "description", current.description),
  dueAt: mergeDate(body, "dueAt", current.dueAt),
  labels: optionalStringList(body, "labels") ?? current.labels,
  recurrence: mergeRecurrence(body, "recurrence", current.recurrence),
});

// Assignees arrive as member e-mails (user ids differ per environment); the route
// resolves them via resolveAssigneeUserIds.
export const parseAssigneeEmails = (body: Body): string[] | undefined =>
  optionalStringList(body, "assignees");

export const parseCreatePerson = (body: Body, enums: OrgEnums): CreatePersonInput => ({
  // Optional: a rapport person exists before any client record does.
  clientId: optionalText(body, "clientId"),
  name: requireText(body, "name"),
  kind: optionalOrgEnum(body, "kind", enums, "person_kind"),
  role: optionalText(body, "role"),
  email: optionalText(body, "email"),
  phone: optionalText(body, "phone"),
  note: optionalText(body, "note"),
  isPrimary: optionalBoolean(body, "isPrimary"),
});

export const parseUpdatePerson = (body: Body, enums: OrgEnums): UpdatePersonInput => ({
  name: optionalText(body, "name"),
  kind: optionalOrgEnum(body, "kind", enums, "person_kind"),
  clientId: nullableText(body, "clientId"),
  role: nullableText(body, "role"),
  email: nullableText(body, "email"),
  phone: nullableText(body, "phone"),
  note: nullableText(body, "note"),
});

export const wantsPrimary = (body: Body): boolean => optionalBoolean(body, "isPrimary") === true;

export const hasPersonPatch = (patch: UpdatePersonInput): boolean =>
  patch.name !== undefined ||
  patch.kind !== undefined ||
  patch.clientId !== undefined ||
  patch.role !== undefined ||
  patch.email !== undefined ||
  patch.phone !== undefined ||
  patch.note !== undefined;

export const parseCreateRapportEntry = (
  personId: string,
  body: Body,
  enums: OrgEnums,
): CreateRapportEntryInput => ({
  personId,
  content: requireText(body, "content"),
  kind: optionalOrgEnum(body, "kind", enums, "rapport_entry_kind"),
  happenedAt: optionalDate(body, "happenedAt"),
});

// Only activity types whose semantic is loggable (note/call/meeting) can be added by
// hand, mirroring the store guard. System and imported-mail types stay off the API.
const LOGGABLE_ACTIVITY_SEMANTICS: ReadonlySet<string> = new Set(["note", "call", "meeting"]);

const requireLoggableActivityType = (body: Body, key: string, enums: OrgEnums): string => {
  const value = asTrimmed(body[key]);
  if (value === undefined) {
    throw new HttpError(400, `Pole ${key} má neplatnou hodnotu.`);
  }
  const option = enums.activity_type.find((entry) => entry.value === value);
  if (
    option === undefined ||
    option.semantic === undefined ||
    !LOGGABLE_ACTIVITY_SEMANTICS.has(option.semantic)
  ) {
    throw new HttpError(400, `Pole ${key} má neplatnou hodnotu.`);
  }
  return value;
};

export const parseAddActivity = (body: Body, enums: OrgEnums): AddActivityInput => ({
  clientId: requireText(body, "clientId"),
  type: requireLoggableActivityType(body, "type", enums),
  title: requireText(body, "title"),
  body: optionalText(body, "body"),
  dealId: optionalText(body, "dealId"),
  projectId: optionalText(body, "projectId"),
});

export const parseCreateDocument = (body: Body, enums: OrgEnums): CreateDocumentInput => ({
  clientId: requireText(body, "clientId"),
  kind: requireOrgEnum(body, "kind", enums, "doc_kind"),
  title: requireText(body, "title"),
  url: optionalText(body, "url"),
  amountCzk: optionalNumber(body, "amountCzk", { min: 0 }),
});

export const parseUpdateDocument = (current: Doc, body: Body, enums: OrgEnums): DocumentInput => ({
  kind: optionalOrgEnum(body, "kind", enums, "doc_kind") ?? current.kind,
  title: optionalText(body, "title") ?? current.title,
  url: mergeText(body, "url", current.url),
  amountCzk: mergeNumber(body, "amountCzk", current.amountCzk, { min: 0 }),
});

export const parseDealStage = (body: Body, enums: OrgEnums): string =>
  requireOrgEnum(body, "stage", enums, "deal_stage");

export const parseTicketStatus = (body: Body, enums: OrgEnums): string =>
  requireOrgEnum(body, "status", enums, "ticket_status");
