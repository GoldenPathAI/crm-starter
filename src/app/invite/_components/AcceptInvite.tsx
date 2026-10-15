"use client"

import { Check } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { Button } from "@/app/_ui/Button"
import { Spinner } from "@/app/_ui/Spinner"
import { orgHref } from "@/lib/nav"
import { acceptInvitationAction } from "../actions"

export function AcceptInvite({
  invitationId,
  orgSlug,
  orgName,
}: {
  invitationId: string
  orgSlug: string
  orgName: string
}) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | undefined>(undefined)

  const onAccept = async (): Promise<void> => {
    setPending(true)
    setError(undefined)
    const result = await acceptInvitationAction(invitationId)
    if (result.status === "error") {
      setError(result.message)
      setPending(false)

      return
    }

    router.push(orgHref(orgSlug, "/prehled"))
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <h2 className="text-[20px] font-semibold tracking-tight text-foreground">
          Pozvánka do workspace
        </h2>
        <p className="text-[13px] leading-relaxed text-muted">
          Byl jsi pozván do workspace <span className="font-medium text-foreground">{orgName}</span>.
          Přijetím získáš přístup k jejímu CRM.
        </p>
      </div>
      {error !== undefined ? <p className="text-xs font-medium text-danger">{error}</p> : null}
      <Button
        type="button"
        size="md"
        onClick={() => void onAccept()}
        disabled={pending}
        className="w-full cursor-pointer"
      >
        {pending ? <Spinner className="size-4" /> : <Check className="size-4" />}
        Přijmout pozvánku
      </Button>
    </div>
  )
}
