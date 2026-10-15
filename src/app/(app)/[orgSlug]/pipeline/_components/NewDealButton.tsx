"use client"

import { useState, useTransition } from "react"
import { Plus } from "lucide-react"
import { Button } from "@/app/_ui/Button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/app/_ui/Dialog"
import { ToastVariant, useToast } from "@/app/_ui/Toast"
import { useOrg } from "@/app/_components/org/OrgProvider"
import type { DealStage, EnumOption, OrgMember } from "@/core/types/crm.types"
import type { ClientOption } from "@/lib/crm/store/deals"
import { createDealAction } from "../actions"
import type { DealFormValues } from "../_lib/types"
import { DealForm } from "./DealForm"

export function NewDealButton({
  clientOptions,
  stageOptions,
  members,
}: {
  clientOptions: ClientOption[]
  stageOptions: EnumOption[]
  members: OrgMember[]
}) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [assigneeIds, setAssigneeIds] = useState<string[]>([])
  const { toast } = useToast()
  const { orgSlug } = useOrg()

  const handleSubmit = (values: DealFormValues, stage: DealStage) => {
    startTransition(async () => {
      const result = await createDealAction(orgSlug, values, stage, assigneeIds)
      if (result.status === "success") {
        toast({ variant: ToastVariant.Success, title: result.message })
        setAssigneeIds([])
        setOpen(false)
      } else if (result.status === "error") {
        toast({ variant: ToastVariant.Error, title: result.message })
      }
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) {
          setAssigneeIds([])
        }
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="size-4" />
          Nový deal
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nový deal</DialogTitle>
        </DialogHeader>
        {open ? (
          <DealForm
            idPrefix="new-deal"
            clientOptions={clientOptions}
            stageOptions={stageOptions}
            includeStage
            submitLabel="Vytvořit deal"
            pending={pending}
            onSubmit={handleSubmit}
            members={members}
            assigneeIds={assigneeIds}
            onAssigneeIdsChange={setAssigneeIds}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
