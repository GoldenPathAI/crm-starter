"use client"

import { useOrg } from "@/app/_components/org/OrgProvider"
import { ToastVariant, useToast } from "@/app/_ui/Toast"
import { undoUiAction } from "@/app/_lib/undoActions"
import type { ActionState } from "@/app/_lib/actionState"

type SuccessState = Extract<ActionState, { status: "success" }>

interface UndoToast {
  // Shows a success toast for a destructive action. When the action carried an
  // undoable batch id, the toast gets a "Zpět" button that reverts the batch and
  // reports the outcome. `onReverted` runs after a successful undo so the caller can
  // refresh the surface (revalidatePath alone does not re-render the client tree).
  toastWithUndo: (result: SuccessState, onReverted?: () => void) => void
}

export function useUndoToast(): UndoToast {
  const { toast } = useToast()
  const { orgSlug } = useOrg()

  const toastWithUndo = (result: SuccessState, onReverted?: () => void): void => {
    const requestId = result.requestId
    toast({
      variant: ToastVariant.Success,
      title: result.message,
      action:
        requestId !== undefined
          ? {
              label: "Zpět",
              onAction: () => {
                void (async () => {
                  const undo = await undoUiAction(orgSlug, requestId)
                  if (undo.status === "success") {
                    toast({ variant: ToastVariant.Success, title: undo.message })
                    onReverted?.()
                  } else if (undo.status === "error") {
                    toast({ variant: ToastVariant.Error, title: undo.message })
                  }
                })()
              },
            }
          : undefined,
    })
  }

  return { toastWithUndo }
}
