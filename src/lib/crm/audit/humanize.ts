// Pure, DB-free mapping of an audit row to Czech UI copy. Kept side-effect free so
// it renders on the server and unit-tests without a database. The input is a
// structural subset of AuditEntry, so audit rows pass straight through.

export interface HumanizableEntry {
  tableName: string
  operation: "INSERT" | "UPDATE" | "DELETE"
  before: Record<string, unknown> | null
  after: Record<string, unknown> | null
  rowId: string
}

export interface HumanizedEntry {
  entity: string
  verb: string
  name: string
  changes: string
}

const ENTITY_LABELS: Readonly<Record<string, string>> = {
  clients: "Klient",
  people: "Kontakt",
  deals: "Deal",
  projects: "Projekt",
  tickets: "Úkol",
  ticket_assignees: "Řešitelé úkolu",
  deal_assignees: "Řešitelé dealu",
  activities: "Aktivita",
  documents: "Dokument",
  enum_options: "Číselník",
  organization_settings: "Nastavení",
  client_lead_links: "Napojení na lead",
}

const OPERATION_VERBS: Readonly<Record<HumanizableEntry["operation"], string>> = {
  INSERT: "vytvořeno",
  UPDATE: "upraveno",
  DELETE: "smazáno",
}

// Czech labels for the columns that show up most in a diff. Unmapped keys fall back
// to their raw name, so a new column is still readable, just untranslated.
const FIELD_LABELS: Readonly<Record<string, string>> = {
  name: "název",
  title: "název",
  status: "stav",
  stage: "fáze",
  priority: "priorita",
  note: "poznámka",
  next_step: "další krok",
  description: "popis",
  value_czk: "hodnota",
  amount_czk: "částka",
  mrr_czk: "MRR",
  due_at: "termín",
  issued_at: "vystaveno",
  invoice_status: "stav faktury",
  kind: "druh",
  industry: "obor",
  city: "město",
  ico: "IČO",
  website: "web",
  email: "e-mail",
  phone: "telefon",
  role: "role",
  is_primary: "hlavní kontakt",
  client_id: "klient",
  project_id: "projekt",
  last_contact_at: "poslední kontakt",
  done_at: "dokončeno",
  order: "pořadí",
  position: "pozice",
  label: "popisek",
  color: "barva",
  url: "odkaz",
  services: "služby",
}

// Timestamps the app bumps on every write carry no signal in a change summary.
const IGNORED_FIELDS: ReadonlySet<string> = new Set(["updated_at", "created_at"])

const NAME_KEYS: readonly string[] = ["name", "title"]

const MAX_CHANGED_FIELDS = 4

export const entityLabel = (tableName: string): string => ENTITY_LABELS[tableName] ?? tableName

export const operationVerb = (operation: HumanizableEntry["operation"]): string =>
  OPERATION_VERBS[operation]

// A readable name for the row: prefers name/title from the surviving snapshot
// (after for insert/update, before for delete), falling back to the opaque row id.
export const displayName = (entry: HumanizableEntry): string => {
  const source = entry.after ?? entry.before
  if (source !== null) {
    for (const key of NAME_KEYS) {
      const value = source[key]
      if (typeof value === "string" && value.trim().length > 0) {
        return value
      }
    }
  }

  return entry.rowId
}

const valuesEqual = (a: unknown, b: unknown): boolean => {
  if (a === b) {
    return true
  }

  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null)
}

// Labels of the columns that actually changed in an UPDATE, before/after diffed.
// Non-updates and missing snapshots yield an empty list.
export const changedFieldLabels = (entry: HumanizableEntry): string[] => {
  if (entry.operation !== "UPDATE" || entry.before === null || entry.after === null) {
    return []
  }

  const before = entry.before
  const after = entry.after
  const keys = new Set([...Object.keys(before), ...Object.keys(after)])
  const changed: string[] = []
  for (const key of keys) {
    if (IGNORED_FIELDS.has(key)) {
      continue
    }

    if (!valuesEqual(before[key], after[key])) {
      changed.push(FIELD_LABELS[key] ?? key)
    }
  }

  return changed
}

// Compact one-line summary of changed fields, capped at MAX_CHANGED_FIELDS with a
// "+N" overflow marker. Empty string when nothing meaningful changed.
export const changedFieldsSummary = (entry: HumanizableEntry): string => {
  const labels = changedFieldLabels(entry)
  if (labels.length === 0) {
    return ""
  }

  const shown = labels.slice(0, MAX_CHANGED_FIELDS)
  const rest = labels.length - shown.length
  const joined = shown.join(", ")

  return rest > 0 ? `${joined} +${rest}` : joined
}

export const humanizeEntry = (entry: HumanizableEntry): HumanizedEntry => ({
  entity: entityLabel(entry.tableName),
  verb: operationVerb(entry.operation),
  name: displayName(entry),
  changes: changedFieldsSummary(entry),
})
