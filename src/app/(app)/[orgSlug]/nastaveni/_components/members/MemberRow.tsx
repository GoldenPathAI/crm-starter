"use client"

import { Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useTransition } from "react"
import type { OrgRole } from "@/core/types/crm.types"
import type { SettingsMember } from "@/lib/crm/store/members"
import { Avatar } from "@/app/_ui/Avatar"
import { Button } from "@/app/_ui/Button"
import { ConfirmDialog } from "@/app/_ui/ConfirmDialog"
import { Select } from "@/app/_ui/Select"
import { Spinner } from "@/app/_ui/Spinner"
import { useToast } from "@/app/_ui/Toast"
import { cn } from "@/lib/cn"
import { changeMemberRoleAction, removeMemberAction } from "@/app/(app)/[orgSlug]/nastaveni/actions"
import { actionToast } from "./notify"
import { ROLE_BADGE, ROLE_LABEL } from "./roles"

const ROLE_OPTIONS_BASE: ReadonlyArray<{ value: OrgRole; label: string }> = [
  { value: "member", label: ROLE_LABEL.member },
  { value: "admin", label: ROLE_LABEL.admin },
]

export function MemberRow({
  orgSlug,
  member,
  isSelf,
  canEditRole,
  canRemove,
  allowOwnerRole,
}: {
  orgSlug: string
  member: SettingsMember
  isSelf: boolean
  canEditRole: boolean
  canRemove: boolean
  allowOwnerRole: boolean
}) {
  const { toast } = useToast()
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const roleOptions =
    allowOwnerRole || member.role === "owner"
      ? [...ROLE_OPTIONS_BASE, { value: "owner" as OrgRole, label: ROLE_LABEL.owner }]
      : [...ROLE_OPTIONS_BASE]

  const onRoleChange = (nextRole: string): void => {
    if (nextRole === member.role) {
      return
    }

    startTransition(async () => {
      const result = await changeMemberRoleAction(orgSlug, {
        memberId: member.memberId,
        role: nextRole,
      })
      const notice = actionToast(result)
      if (notice !== null) {
        toast(notice)
      }

      router.refresh()
    })
  }

  const onRemove = async (): Promise<void> => {
    const result = await removeMemberAction(orgSlug, { memberId: member.memberId })
    const notice = actionToast(result)
    if (notice !== null) {
      toast(notice)
    }

    router.refresh()
  }

  return (
    <li className="flex items-center gap-4 px-6 py-4">
      <Avatar name={member.name} userId={member.userId} size="md" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium text-foreground">{member.name}</span>
          {isSelf ? <span className="text-xs text-muted-soft">(ty)</span> : null}
        </div>
        <p className="truncate text-xs text-muted">{member.email}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {canEditRole ? (
          <div className="flex items-center gap-2">
            {pending ? <Spinner className="size-4 text-muted" /> : null}
            <Select
              value={member.role}
              onValueChange={onRoleChange}
              options={roleOptions}
              disabled={pending}
              className="h-9 w-32"
            />
          </div>
        ) : (
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
              ROLE_BADGE[member.role],
            )}
          >
            {ROLE_LABEL[member.role]}
          </span>
        )}
        {canRemove ? (
          <ConfirmDialog
            trigger={
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-9 cursor-pointer text-muted-soft hover:text-danger"
                aria-label="Odebrat člena"
              >
                <Trash2 className="size-4" />
              </Button>
            }
            title="Odebrat člena"
            description={`Opravdu odebrat ${member.name} z workspace? Ztratí veškerý přístup.`}
            confirmLabel="Odebrat"
            onConfirm={onRemove}
            destructive
          />
        ) : null}
      </div>
    </li>
  )
}
