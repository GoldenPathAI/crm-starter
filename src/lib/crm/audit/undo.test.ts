import { describe, expect, it } from "vitest"
import type { AuditEntry } from "@/lib/crm/audit/queries"
import { lastTouchPerRow } from "@/lib/crm/audit/undo"

const entry = (id: string, tableName: string, rowId: string, operation: AuditEntry["operation"]): AuditEntry => ({
  id,
  organizationId: "org_1",
  tableName,
  rowId,
  operation,
  before: null,
  after: { id: rowId },
  actorType: "user",
  actorUserId: "user_1",
  onBehalfUserId: null,
  source: "ui",
  requestId: "req_1",
  undoOf: null,
  createdAt: new Date("2026-10-15T10:00:00Z"),
})

describe("lastTouchPerRow", () => {
  it("keeps only the last entry of a row the batch touched several times", () => {
    const batch = [
      entry("a1", "clients", "cl_1", "INSERT"),
      entry("a2", "people", "pe_1", "INSERT"),
      entry("a3", "clients", "cl_1", "UPDATE"),
    ]

    expect(lastTouchPerRow(batch).map((item) => item.id)).toEqual(["a3", "a2"])
  })

  it("keeps the same row id in different tables apart", () => {
    const batch = [entry("a1", "clients", "x", "INSERT"), entry("a2", "deals", "x", "DELETE")]

    expect(lastTouchPerRow(batch).map((item) => item.id)).toEqual(["a1", "a2"])
  })
})
