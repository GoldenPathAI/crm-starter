"use client"

import type { OrgRole } from "@/core/types/crm.types"
import type { SettingsMember } from "@/lib/crm/store/members"
import { Card, CardHeader, CardTitle } from "@/app/_ui/Card"
import { MemberRow } from "./MemberRow"

export function MembersCard({
  orgSlug,
  members,
  viewerRole,
  viewerUserId,
}: {
  orgSlug: string
  members: SettingsMember[]
  viewerRole: OrgRole
  viewerUserId: string
}) {
  const canManage = viewerRole === "admin" || viewerRole === "owner"
  const ownerCount = members.filter((member) => member.role === "owner").length

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Členové</CardTitle>
          <p className="mt-1 text-sm text-muted">Lidé s přístupem do této workspace</p>
        </div>
      </CardHeader>
      <ul className="divide-y divide-hairline">
        {members.map((member) => {
          const rowIsOwner = member.role === "owner"
          const canEditRow = canManage && (!rowIsOwner || viewerRole === "owner")
          const removable = canEditRow && !(rowIsOwner && ownerCount === 1)

          return (
            <MemberRow
              key={member.memberId}
              orgSlug={orgSlug}
              member={member}
              isSelf={member.userId === viewerUserId}
              canEditRole={canEditRow}
              canRemove={removable}
              allowOwnerRole={viewerRole === "owner"}
            />
          )
        })}
      </ul>
    </Card>
  )
}
