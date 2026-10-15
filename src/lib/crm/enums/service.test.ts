import { describe, expect, it, vi } from "vitest"
import type { enumOptions } from "@/lib/db/schema/crm"
import {
  assertValidValue,
  getBySemantic,
  listOptions,
  loadOrgEnumsUncached,
} from "@/lib/crm/enums/service"

type EnumOptionRow = typeof enumOptions.$inferSelect

// The service reads one org's active options in a single query; the fake answers that
// query from a fixed table, already ordered by kind and position like the real one.
const { ROWS } = vi.hoisted(() => {
  const createdAt = new Date("2026-01-01T00:00:00Z")
  const row = (
    kind: EnumOptionRow["kind"],
    value: string,
    position: number,
    semantic: string | null,
  ): EnumOptionRow => ({
    id: `eo_${kind}_${value}`,
    organizationId: "org_1",
    kind,
    value,
    label: value,
    color: "slate",
    position,
    semantic,
    defaultProbability: null,
    archivedAt: null,
    createdAt,
    updatedAt: createdAt,
  })

  return {
    ROWS: [
      row("deal_stage", "lead", 0, "open"),
      row("deal_stage", "vyhrano", 1, "won"),
      row("deal_stage", "prohrano", 2, "lost"),
      row("ticket_status", "hotovo", 0, "done"),
    ],
  }
})

vi.mock("@/lib/db/client", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          orderBy: () => Promise.resolve(ROWS),
        }),
      }),
    }),
  },
}))

describe("loadOrgEnumsUncached", () => {
  it("groups the options by kind in position order and lists every kind", async () => {
    const enums = await loadOrgEnumsUncached("org_1")

    expect(enums.deal_stage.map((option) => option.value)).toEqual(["lead", "vyhrano", "prohrano"])
    expect(enums.ticket_status.map((option) => option.semantic)).toEqual(["done"])
    expect(enums.rapport_entry_kind).toEqual([])
  })
})

describe("assertValidValue", () => {
  it("accepts a value the org has", async () => {
    await expect(assertValidValue("org_1", "deal_stage", "vyhrano")).resolves.toBeUndefined()
  })

  it("rejects a value from another kind or an unknown one", async () => {
    await expect(assertValidValue("org_1", "deal_stage", "hotovo")).rejects.toThrow(
      "Neplatná hodnota hotovo pro číselník deal_stage.",
    )
    await expect(assertValidValue("org_1", "ticket_status", "Hotovo")).rejects.toThrow()
  })
})

describe("getBySemantic", () => {
  it("finds the option code branches on, whatever the org named it", async () => {
    const won = await getBySemantic("org_1", "deal_stage", "won")

    expect(won.value).toBe("vyhrano")
  })

  it("fails loudly when a required semantic is missing", async () => {
    await expect(getBySemantic("org_1", "ticket_status", "open")).rejects.toThrow(
      "Chybí povinná hodnota číselníku ticket_status/open",
    )
  })
})

describe("listOptions", () => {
  it("returns an empty list for a kind without options", async () => {
    await expect(listOptions("org_1", "doc_kind")).resolves.toEqual([])
  })
})
