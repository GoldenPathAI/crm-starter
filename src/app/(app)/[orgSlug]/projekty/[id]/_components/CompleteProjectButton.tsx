"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { CheckCircle2 } from "lucide-react"
import { Button } from "@/app/_ui/Button"
import { Spinner } from "@/app/_ui/Spinner"
import { ToastVariant, useToast } from "@/app/_ui/Toast"
import { useOrg } from "@/app/_components/org/OrgProvider"
import { changeProjectStatusAction } from "../actions"

export function CompleteProjectButton({
  projectId,
  doneStatus,
}: {
  projectId: string
  doneStatus: string
}) {
  const { orgSlug } = useOrg()
  const { toast } = useToast()
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const complete = () => {
    startTransition(async () => {
      const result = await changeProjectStatusAction(orgSlug, { projectId, status: doneStatus })
      if (result.status === "success") {
        toast({ variant: ToastVariant.Success, title: "Projekt dokončen." })
        router.refresh()
      } else if (result.status === "error") {
        toast({ variant: ToastVariant.Error, title: result.message })
      }
    })
  }

  return (
    <Button type="button" size="sm" onClick={complete} disabled={isPending}>
      {isPending ? <Spinner className="size-4" /> : <CheckCircle2 className="size-4" />}
      Dokončit projekt
    </Button>
  )
}
