import { NextResponse } from "next/server"

import { config } from "@/lib/config"

export const dynamic = "force-dynamic"

// Reports the running deploy's id so a client can tell when it is running an outdated
// bundle (stale tab after a deploy) and reload itself. Public and cheap: no DB, no auth.
export function GET(): NextResponse {
  return NextResponse.json({ deployId: config.deployId() })
}
