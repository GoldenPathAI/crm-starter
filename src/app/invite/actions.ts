"use server"

import { headers } from "next/headers"
import { auth } from "@/lib/auth/auth"
import type { ActionState } from "@/app/_lib/actionState"

export async function acceptInvitationAction(invitationId: string): Promise<ActionState> {
  try {
    await auth.api.acceptInvitation({
      body: { invitationId },
      headers: await headers(),
    })
    return { status: "success", message: "Pozvánka přijata." }
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error && error.message.length > 0
          ? error.message
          : "Pozvánku se nepodařilo přijmout.",
    }
  }
}
