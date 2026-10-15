import { newRequestId, runAudited } from "@/lib/crm/audit/context"
import type { OrgScope } from "@/core/types/crm.types"

interface UiAuditContext {
  user: { id: string }
  scope: OrgScope
}

// Runs the mutating store calls of one human UI action inside a single audited
// transaction (source "ui"), so the DB audit trigger attributes every written row to
// the acting user. One call = one requestId = one undoable batch. `fn` receives a
// scope whose `db` is the open transaction (so every store call it makes is
// attributed and atomic) plus the batch `requestId`, which destructive actions
// return in their ActionState so the UI can offer an undo.
export async function withUiAudit<T>(
  ctx: UiAuditContext,
  fn: (scope: OrgScope, requestId: string) => Promise<T>,
): Promise<T> {
  const requestId = newRequestId()

  return runAudited(
    {
      orgId: ctx.scope.orgId,
      source: "ui",
      requestId,
      actorType: "user",
      actorUserId: ctx.user.id,
    },
    (tx) => fn({ ...ctx.scope, db: tx }, requestId),
  )
}
