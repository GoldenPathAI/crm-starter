import type { ActionState } from "@/app/_lib/actionState"

export function actionToast(
  result: ActionState,
): { variant: "success" | "error"; title: string } | null {
  if (result.status === "idle") {
    return null
  }
  return {
    variant: result.status === "success" ? "success" : "error",
    title: result.message,
  }
}
