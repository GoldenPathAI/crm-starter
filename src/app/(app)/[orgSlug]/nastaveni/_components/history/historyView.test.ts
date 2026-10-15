import { describe, expect, it } from "vitest"
import type { AuditEntryWithActor } from "@/lib/crm/audit/queries"
import { buildHistoryBatches } from "@/app/(app)/[orgSlug]/nastaveni/_components/history/historyView"

const row = (
  id: string,
  requestId: string | null,
  overrides: Partial<AuditEntryWithActor> = {},
): AuditEntryWithActor => ({
  id,
  organizationId: "org_1",
  tableName: "clients",
  rowId: `cl_${id}`,
  operation: "INSERT",
  before: null,
  after: { name: `Klient ${id}` },
  actorType: "user",
  actorUserId: "user_1",
  onBehalfUserId: null,
  source: "ui",
  requestId,
  undoOf: null,
  createdAt: new Date("2026-10-15T10:00:00Z"),
  actorName: "Filip",
  onBehalfName: null,
  ...overrides,
})

describe("buildHistoryBatches", () => {
  // Rows arrive newest first, the way listRecentAudit returns them.
  const rows = [row("3", "req_b"), row("2", "req_a"), row("1", "req_a"), row("0", null, { source: null })]

  it("groups rows by request id in newest-first order, one batch per write outside runAudited", () => {
    const batches = buildHistoryBatches(rows, new Set())

    expect(batches.map((batch) => batch.key)).toEqual(["req_b", "req_a", "row:0"])
  })

  it("lists a batch's entries oldest first", () => {
    const [, batchA] = buildHistoryBatches(rows, new Set())

    expect(batchA?.entries.map((entry) => entry.id)).toEqual(["1", "2"])
  })

  it("offers undo only for application batches that were not undone yet", () => {
    const batches = buildHistoryBatches(rows, new Set(["req_b"]))

    expect(batches.map((batch) => [batch.key, batch.undoable, batch.undone])).toEqual([
      ["req_b", false, true],
      ["req_a", true, false],
      ["row:0", false, false],
    ])
  })

  it("labels the source and the actor in Czech", () => {
    const [batchB, , loose] = buildHistoryBatches(rows, new Set())

    expect(batchB?.sourceLabel).toBe("Aplikace")
    expect(batchB?.actorLabel).toBe("Filip")
    expect(loose?.sourceLabel).toBe("Systém")
  })
})
