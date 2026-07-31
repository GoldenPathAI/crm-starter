export type ActionState =
  | { status: "idle" }
  | { status: "success"; message: string; requestId?: string }
  | { status: "error"; message: string }

export const idleState: ActionState = { status: "idle" }
