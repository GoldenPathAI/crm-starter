import { NextResponse } from "next/server"

import { db } from "@/lib/db/client"
import { organizations } from "@/lib/db/schema/org"

export const dynamic = "force-dynamic"

// Unauthenticated liveness probe for an external uptime monitor. A full-row SELECT on
// crm.organizations catches schema drift, not just raw connectivity: if a column
// the app expects is gone, the mapped select throws and the probe reports 503.
export async function GET(): Promise<NextResponse> {
  try {
    await db.select().from(organizations).limit(1)

    return NextResponse.json({ status: "ok" }, { status: 200 })
  } catch {
    return NextResponse.json({ status: "error" }, { status: 503 })
  }
}
