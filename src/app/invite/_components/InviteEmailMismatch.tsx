"use client"

import { LogOut } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { Button } from "@/app/_ui/Button"
import { Spinner } from "@/app/_ui/Spinner"
import { authClient } from "@/lib/auth/authClient"

export function InviteEmailMismatch({
  invitationId,
  invitedEmail,
  currentEmail,
}: {
  invitationId: string
  invitedEmail: string
  currentEmail: string
}) {
  const router = useRouter()
  const [pending, setPending] = useState(false)

  const onSwitch = async (): Promise<void> => {
    setPending(true)
    await authClient.signOut()
    router.push(`/login?next=${encodeURIComponent(`/invite/${invitationId}`)}`)
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <h2 className="text-[20px] font-semibold tracking-tight text-foreground">
          Pozvánka je na jiný e-mail
        </h2>
        <p className="text-[13px] leading-relaxed text-muted">
          Pozvánka je pro <span className="font-medium text-foreground">{invitedEmail}</span>, ale
          jsi přihlášen jako <span className="font-medium text-foreground">{currentEmail}</span>.
          Odhlas se a přihlas účtem, na který pozvánka míří.
        </p>
      </div>
      <Button
        type="button"
        variant="outline"
        size="md"
        onClick={onSwitch}
        disabled={pending}
        className="w-full cursor-pointer"
      >
        {pending ? <Spinner className="size-4" /> : <LogOut className="size-4" />}
        Přihlásit se jiným účtem
      </Button>
    </div>
  )
}
