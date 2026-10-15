import { formatDistanceToNow, parseISO } from "date-fns"
import { cs } from "date-fns/locale"
import { humanizeEntry, type HumanizedEntry } from "@/lib/crm/audit/humanize"
import type { AuditEntryWithActor } from "@/lib/crm/audit/queries"

// Serializable shapes handed from the server panel to the client list. The list is
// a "use client" island (undo needs pending state + toast), so everything it renders
// is precomputed here and passed as plain data.

export interface HistoryEntryView extends HumanizedEntry {
  id: string
  operation: AuditEntryWithActor["operation"]
}

export interface HistoryBatchView {
  key: string
  requestId: string | null
  sourceLabel: string
  actorLabel: string
  createdLabel: string
  createdAt: string
  entries: HistoryEntryView[]
  undoable: boolean
  undone: boolean
}

const SOURCE_LABELS: Readonly<Record<string, string>> = {
  ui: "Aplikace",
  assistant: "AI asistent",
  undo: "Vrácení",
  internal_api: "API",
  cli: "CLI",
  script: "Skript",
  system: "Systém",
}

const sourceLabel = (source: string | null): string =>
  source === null ? "Systém" : SOURCE_LABELS[source] ?? source

const actorLabel = (entry: AuditEntryWithActor): string => {
  if (entry.actorType === "ai") {
    return "AI asistent"
  }

  if (entry.actorType === "system" || entry.actorType === null) {
    return "Systém"
  }

  return entry.actorName ?? "Uživatel"
}

// Only application and assistant batches carry a request id and reverse cleanly.
const isUndoableSource = (source: string | null): boolean =>
  source === "ui" || source === "assistant"

// Groups the flat, newest-first audit rows into batches keyed by request id. Rows
// with no request id (writes outside runAudited) each stand alone. Entries inside a
// batch are ordered oldest-first so they read in the order they were written.
export function buildHistoryBatches(
  rows: readonly AuditEntryWithActor[],
  undoneRequestIds: ReadonlySet<string>,
): HistoryBatchView[] {
  const batches: HistoryBatchView[] = []
  const byKey = new Map<string, HistoryBatchView>()

  for (const row of rows) {
    const key = row.requestId ?? `row:${row.id}`
    const entryView: HistoryEntryView = { id: row.id, operation: row.operation, ...humanizeEntry(row) }
    const existing = byKey.get(key)
    if (existing !== undefined) {
      existing.entries.unshift(entryView)
      continue
    }

    const undone = row.requestId !== null && undoneRequestIds.has(row.requestId)
    const batch: HistoryBatchView = {
      key,
      requestId: row.requestId,
      sourceLabel: sourceLabel(row.source),
      actorLabel: actorLabel(row),
      createdLabel: formatDistanceToNow(parseISO(row.createdAt.toISOString()), {
        locale: cs,
        addSuffix: true,
      }),
      createdAt: row.createdAt.toISOString(),
      entries: [entryView],
      undoable: !undone && row.requestId !== null && isUndoableSource(row.source),
      undone,
    }
    byKey.set(key, batch)
    batches.push(batch)
  }

  return batches
}
