import { db } from "@/lib/db/client"
import type { CrmDbc } from "@/lib/db/client"
import type { OrgScope } from "@/core/types/crm.types"

// Resolve the handle a store function must use: a caller-supplied transaction when
// the scope carries one (audited batch), otherwise the shared pool.
export const resolveDbc = (scope: OrgScope): CrmDbc => scope.db ?? db

// Run `fn` inside a transaction. When the handle is the shared pool, open a real
// transaction; when it is already an open transaction (the caller owns it), reuse
// it directly, because postgres-js cannot nest a transaction inside a transaction.
export function withTx<T>(dbc: CrmDbc, fn: (tx: CrmDbc) => Promise<T>): Promise<T> {
  return dbc === db ? db.transaction(fn) : fn(dbc)
}
