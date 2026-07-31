import type { OrgRole } from "@/core/types/crm.types"
import { listPendingInvitations, listSettingsMembers } from "@/lib/crm/store/members"
import { InvitationsCard } from "./InvitationsCard"
import { MembersCard } from "./MembersCard"

export async function MembersPanel({
  orgSlug,
  orgId,
  viewerRole,
  viewerUserId,
}: {
  orgSlug: string
  orgId: string
  viewerRole: OrgRole
  viewerUserId: string
}) {
  const canManage = viewerRole === "admin" || viewerRole === "owner"

  // Sequential on purpose: the DB pool is shared with the live app.
  const members = await listSettingsMembers(orgId)
  const invitations = canManage ? await listPendingInvitations(orgId) : []

  return (
    <div className="flex flex-col gap-6">
      <MembersCard
        orgSlug={orgSlug}
        members={members}
        viewerRole={viewerRole}
        viewerUserId={viewerUserId}
      />
      {canManage ? <InvitationsCard orgSlug={orgSlug} invitations={invitations} /> : null}
    </div>
  )
}
