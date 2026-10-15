import { eq } from "drizzle-orm"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { REQUIRED_SEMANTICS } from "@/core/enumDefaults"
import { ENUM_KINDS, type OrgScope } from "@/core/types/crm.types"
import { newRequestId, runAudited } from "@/lib/crm/audit/context"
import { undoBatch } from "@/lib/crm/audit/undo"
import { assertValidValue, getBySemantic, loadOrgEnumsUncached } from "@/lib/crm/enums/service"
import { createClient } from "@/lib/crm/store/clients"
import { seedOrganizationDefaults } from "@/lib/crm/store/orgDefaults"
import { db, getSql } from "@/lib/db/client"
import { clients } from "@/lib/db/schema/crm"
import { organizations } from "@/lib/db/schema/org"
import { createId } from "@/lib/ids"

// One throwaway workspace per run; deleting it cascades to every row the suite wrote.
const orgId = createId("org")
const systemScope: OrgScope = { orgId, actor: { type: "system" } }

beforeAll(async () => {
  await db.insert(organizations).values({ id: orgId, name: "Integration test", slug: orgId })
  await seedOrganizationDefaults(orgId)
})

afterAll(async () => {
  await db.delete(organizations).where(eq(organizations.id, orgId))
  await getSql().end()
})

describe("seeded workspace enums", () => {
  it("gives a new workspace options for every kind", async () => {
    const enums = await loadOrgEnumsUncached(orgId)

    expect(ENUM_KINDS.filter((kind) => enums[kind].length === 0)).toEqual([])
  })

  it("covers every semantic the code branches on", async () => {
    const required = Object.entries(REQUIRED_SEMANTICS).flatMap(([kind, semantics]) =>
      (semantics ?? []).map((semantic) => ({ kind, semantic })),
    )
    const enums = await loadOrgEnumsUncached(orgId)
    const missing = required.filter(
      ({ kind, semantic }) =>
        !ENUM_KINDS.some(
          (candidate) =>
            candidate === kind && enums[candidate].some((option) => option.semantic === semantic),
        ),
    )

    expect(missing).toEqual([])
  })

  it("validates values against the workspace's own options", async () => {
    const won = await getBySemantic(orgId, "deal_stage", "won")

    await expect(assertValidValue(orgId, "deal_stage", won.value)).resolves.toBeUndefined()
    await expect(assertValidValue(orgId, "deal_stage", "neexistuje")).rejects.toThrow()
  })
})

describe("audit log and undo", () => {
  it("reverts an audited batch that created a client", async () => {
    const active = await getBySemantic(orgId, "client_status", "active")
    const requestId = newRequestId()
    const created = await runAudited(
      { orgId, source: "script", requestId, actorType: "system" },
      (tx) =>
        createClient(
          { ...systemScope, db: tx },
          { name: "Undo s.r.o.", industry: "Test", status: active.value, services: [] },
        ),
    )

    const before = await db.select().from(clients).where(eq(clients.id, created.id))
    expect(before).toHaveLength(1)

    const result = await undoBatch(orgId, requestId, {})
    const after = await db.select().from(clients).where(eq(clients.id, created.id))

    expect(result.reverted).toBeGreaterThan(0)
    expect(after).toHaveLength(0)
  })

  it("refuses to undo the same batch twice", async () => {
    const active = await getBySemantic(orgId, "client_status", "active")
    const requestId = newRequestId()
    await runAudited({ orgId, source: "script", requestId, actorType: "system" }, (tx) =>
      createClient(
        { ...systemScope, db: tx },
        { name: "Jednou s.r.o.", industry: "Test", status: active.value, services: [] },
      ),
    )
    await undoBatch(orgId, requestId, {})

    await expect(undoBatch(orgId, requestId, {})).rejects.toThrow("Tato dávka už byla vrácena.")
  })
})
