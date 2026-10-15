import type { Metadata } from "next"
import Link from "next/link"
import { getSessionUser } from "@/lib/auth/orgContext"
import { getInvitationForAcceptance } from "@/lib/crm/store/members"
import { AcceptInvite } from "../_components/AcceptInvite"
import { InviteEmailMismatch } from "../_components/InviteEmailMismatch"
import { InviteShell } from "../_components/InviteShell"
import { InviteSignUp } from "../_components/InviteSignUp"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Pozvánka",
}

function InvitationInvalid() {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <h2 className="text-[20px] font-semibold tracking-tight text-foreground">
          Pozvánka není platná
        </h2>
        <p className="text-[13px] leading-relaxed text-muted">
          Tahle pozvánka už neexistuje, byla přijata nebo jí vypršela platnost. Požádej správce
          workspace o novou.
        </p>
      </div>
      <Link
        href="/login"
        className="text-center text-[13px] font-medium text-primary hover:underline"
      >
        Zpět na přihlášení
      </Link>
    </div>
  )
}

export default async function InvitePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const invitation = await getInvitationForAcceptance(id)

  const expired =
    invitation?.expiresAt !== undefined &&
    new Date(invitation.expiresAt).getTime() < Date.now()
  const invalid = invitation === null || invitation.status !== "pending" || expired

  if (invalid || invitation === null) {
    return (
      <InviteShell>
        <InvitationInvalid />
      </InviteShell>
    )
  }

  const user = await getSessionUser()

  if (user === null) {
    return (
      <InviteShell>
        <InviteSignUp
          invitationId={invitation.id}
          email={invitation.email}
          orgSlug={invitation.orgSlug}
          orgName={invitation.orgName}
        />
      </InviteShell>
    )
  }

  if (user.email.toLowerCase() === invitation.email.toLowerCase()) {
    return (
      <InviteShell>
        <AcceptInvite
          invitationId={invitation.id}
          orgSlug={invitation.orgSlug}
          orgName={invitation.orgName}
        />
      </InviteShell>
    )
  }

  return (
    <InviteShell>
      <InviteEmailMismatch
        invitationId={invitation.id}
        invitedEmail={invitation.email}
        currentEmail={user.email}
      />
    </InviteShell>
  )
}
