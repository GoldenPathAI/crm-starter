import type { EnumKind } from "@/core/types/crm.types"
import { requireOrgContext } from "@/lib/auth/orgContext"
import { listAllOptions } from "@/lib/crm/store/enumOptions"
import { EnumsManager, type EnumGroup } from "./EnumsManager"

const KINDS: ReadonlyArray<{ kind: EnumKind; title: string }> = [
  { kind: "deal_stage", title: "Fáze dealů" },
  { kind: "client_status", title: "Stavy klientů" },
  { kind: "service_kind", title: "Služby" },
  { kind: "project_status", title: "Stavy projektů" },
  { kind: "ticket_status", title: "Stavy úkolů" },
  { kind: "ticket_priority", title: "Priority úkolů" },
  { kind: "doc_kind", title: "Typy dokumentů" },
  { kind: "activity_type", title: "Typy aktivit" },
  { kind: "person_kind", title: "Typy osob" },
  { kind: "rapport_entry_kind", title: "Typy záznamů raportu" },
]

export async function EnumsSection({ orgSlug }: { orgSlug: string }) {
  const ctx = await requireOrgContext(orgSlug)
  const canEdit = ctx.role === "admin" || ctx.role === "owner"

  // Sequential on purpose: the DB pool is shared with the live app, so this section
  // holds at most one connection at a time instead of bursting ten parallel reads.
  const groups: EnumGroup[] = []
  for (const { kind, title } of KINDS) {
    const options = await listAllOptions(ctx.scope.orgId, kind)
    groups.push({ kind, title, options })
  }

  return <EnumsManager orgSlug={orgSlug} groups={groups} canEdit={canEdit} />
}
