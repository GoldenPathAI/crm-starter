"use client"

import { Copy, Mail, Trash2, UserPlus } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition, type FormEvent } from "react"
import type { OrgRole } from "@/core/types/crm.types"
import type { PendingInvitation } from "@/lib/crm/store/members"
import { Button } from "@/app/_ui/Button"
import { Card, CardContent, CardHeader, CardTitle } from "@/app/_ui/Card"
import { Field } from "@/app/_ui/Field"
import { Input } from "@/app/_ui/Input"
import { Select } from "@/app/_ui/Select"
import { Spinner } from "@/app/_ui/Spinner"
import { ToastVariant, useToast } from "@/app/_ui/Toast"
import { cn } from "@/lib/cn"
import { config } from "@/lib/config"
import { formatCzechDate } from "@/lib/dates"
import { inviteMemberAction, revokeInvitationAction } from "@/app/(app)/[orgSlug]/nastaveni/actions"
import { actionToast } from "./notify"
import { ROLE_BADGE, ROLE_LABEL } from "./roles"

const INVITE_ROLE_OPTIONS: ReadonlyArray<{ value: OrgRole; label: string }> = [
  { value: "member", label: ROLE_LABEL.member },
  { value: "admin", label: ROLE_LABEL.admin },
]

export function InvitationsCard({
  orgSlug,
  invitations,
}: {
  orgSlug: string
  invitations: PendingInvitation[]
}) {
  const { toast } = useToast()
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [role, setRole] = useState<OrgRole>("member")
  const [pending, startTransition] = useTransition()

  const onInvite = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault()
    startTransition(async () => {
      const result = await inviteMemberAction(orgSlug, { email, role })
      const notice = actionToast(result)
      if (notice !== null) {
        toast(notice)
      }

      if (result.status === "success") {
        setEmail("")
        setRole("member")
        router.refresh()
      }
    })
  }

  const onCopy = async (invitationId: string): Promise<void> => {
    const link = `${config.authBaseUrl}/invite/${invitationId}`
    try {
      await navigator.clipboard.writeText(link)
      toast({ variant: ToastVariant.Success, title: "Odkaz zkopírován" })
    } catch {
      toast({ variant: ToastVariant.Error, title: "Odkaz se nepodařilo zkopírovat" })
    }
  }

  const onRevoke = (invitationId: string): void => {
    startTransition(async () => {
      const result = await revokeInvitationAction(orgSlug, { invitationId })
      const notice = actionToast(result)
      if (notice !== null) {
        toast(notice)
      }

      router.refresh()
    })
  }

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Pozvánky</CardTitle>
          <p className="mt-1 text-sm text-muted">
            Pozvánka se odešle e-mailem, odkaz můžeš poslat i ručně
          </p>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <form onSubmit={onInvite} className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Field label="E-mail" htmlFor="invite-email">
              <Input
                id="invite-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="jmeno@firma.cz"
                autoComplete="off"
                required
              />
            </Field>
          </div>
          <div className="sm:w-40">
            <Field label="Role" htmlFor="invite-role">
              <Select
                id="invite-role"
                value={role}
                onValueChange={(value) => setRole(value === "admin" ? "admin" : "member")}
                options={[...INVITE_ROLE_OPTIONS]}
              />
            </Field>
          </div>
          <Button type="submit" size="md" disabled={pending} className="cursor-pointer">
            {pending ? <Spinner className="size-4" /> : <UserPlus className="size-4" />}
            Pozvat
          </Button>
        </form>

        {invitations.length > 0 ? (
          <ul className="divide-y divide-hairline rounded-xl border border-hairline">
            {invitations.map((invitation) => (
              <li
                key={invitation.id}
                className="flex flex-wrap items-center gap-3 px-4 py-3"
              >
                <Mail className="size-4 shrink-0 text-muted-soft" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{invitation.email}</p>
                  <p className="text-xs text-muted">
                    Pozváno {formatCzechDate(invitation.createdAt)} · Pozvánka odeslána e-mailem
                  </p>
                </div>
                <span
                  className={cn(
                    "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                    ROLE_BADGE[invitation.role],
                  )}
                >
                  {ROLE_LABEL[invitation.role]}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void onCopy(invitation.id)}
                  className="cursor-pointer"
                >
                  <Copy className="size-3.5" />
                  Odkaz
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => onRevoke(invitation.id)}
                  disabled={pending}
                  aria-label="Zrušit pozvánku"
                  className="size-9 cursor-pointer text-muted-soft hover:text-danger"
                >
                  <Trash2 className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">Žádné čekající pozvánky</p>
        )}
      </CardContent>
    </Card>
  )
}
