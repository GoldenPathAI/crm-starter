import { AsyncLocalStorage } from "node:async_hooks"
import { sql } from "drizzle-orm"
import { db } from "@/lib/db/client"
import type { CrmDbc } from "@/lib/db/client"
import { createId } from "@/lib/ids"

// Written into crm.audit_log.source by the trigger, so the values keep their spelling.
export const AUDIT_SOURCES = ["ui", "assistant", "internal_api", "cli", "script", "undo", "system"] as const

export type AuditSource = (typeof AUDIT_SOURCES)[number]

export interface AuditMeta {
  orgId: string
  source: AuditSource
  // Groups every audit row of one logical action or batch under a single id.
  requestId: string
  actorType: "user" | "ai" | "system"
  actorUserId?: string
  // The human whose permissions the AI acted under.
  onBehalfUserId?: string
  // Points an undo batch back at the request it reverses (read by the trigger).
  undoOf?: string
}

// Fresh id for a logical action/batch. Distinct prefix so audit request ids never
// collide with entity ids.
export const newRequestId = (): string => createId("req")

const afterCommitCallbacks = new AsyncLocalStorage<(() => void)[]>()

// Defers a side effect until the enclosing audited transaction commits. Work that reads
// rows the transaction has written (a queue drain, an external push) cannot run while it
// is still open: a pool connection would not see the uncommitted rows. Outside an audited
// transaction there is nothing to wait for and the callback runs at once.
export function onAfterCommit(callback: () => void): void {
  const pending = afterCommitCallbacks.getStore()
  if (pending === undefined) {
    callback()

    return
  }

  pending.push(callback)
}

// Open one transaction, stamp the attribution GUCs so the audit trigger can read
// them, then run `fn` on the transaction. The GUCs are transaction-local
// (set_config ..., true), so they vanish on commit or rollback.
export async function runAudited<T>(meta: AuditMeta, fn: (tx: CrmDbc) => Promise<T>): Promise<T> {
  const pending: (() => void)[] = []
  const result = await afterCommitCallbacks.run(pending, () =>
    db.transaction(async (tx) => {
      await tx.execute(sql`SELECT
        set_config('crm.actor_type', ${meta.actorType}, true),
        set_config('crm.actor_user_id', ${meta.actorUserId ?? ""}, true),
        set_config('crm.on_behalf_user_id', ${meta.onBehalfUserId ?? ""}, true),
        set_config('crm.source', ${meta.source}, true),
        set_config('crm.request_id', ${meta.requestId}, true),
        set_config('crm.undo_of', ${meta.undoOf ?? ""}, true)`)

      return fn(tx)
    }),
  )
  for (const callback of pending) {
    callback()
  }

  return result
}
