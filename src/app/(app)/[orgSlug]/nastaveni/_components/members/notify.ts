import type { ActionState } from "@/app/_lib/actionState"
import { ToastVariant } from "@/app/_ui/Toast"

export function actionToast(
  result: ActionState,
): { variant: ToastVariant.Success | ToastVariant.Error; title: string } | null {
  if (result.status === "idle") {
    return null
  }

  return {
    variant: result.status === "success" ? ToastVariant.Success : ToastVariant.Error,
    title: result.message,
  }
}
