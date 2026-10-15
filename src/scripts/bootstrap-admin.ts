import { and, eq, isNull } from "drizzle-orm"
import { auth } from "@/lib/auth/auth"
import { db, getSql } from "@/lib/db/client"
import { activities } from "@/lib/db/schema/crm"
import { users } from "@/lib/db/schema/auth"
import { organizationMembers } from "@/lib/db/schema/org"
import { getOrgBySlug } from "@/lib/crm/store/organizations"
import { createId } from "@/lib/ids"
import { argValue } from "@/scripts/_args"

interface Args {
  email: string
  name: string
  password: string
  orgSlug: string
  orgName: string
}

function parseArgs(): Args {
  const email = argValue("--email")
  const name = argValue("--name")
  const password = argValue("--password")
  const orgSlug = argValue("--org") ?? process.env.CRM_ORG ?? "default"
  const orgName = argValue("--org-name") ?? orgSlug
  if (email === undefined || name === undefined || password === undefined) {
    console.error(
      "Použití: pnpm bootstrap:admin --email <email> --name <jméno> --password <heslo> [--org <slug>] [--org-name <název>]",
    )
    console.error("Vyžaduje v prostředí BETTER_AUTH_SECRET a DATABASE_URL (pro testy TEST_DATABASE_URL).")
    process.exit(1)
  }

  return { email, name, password, orgSlug, orgName }
}

async function main(): Promise<void> {
  const { email, name, password, orgSlug, orgName } = parseArgs()

  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1)
  let userId = existing[0]?.id
  if (userId === undefined) {
    const created = await auth.api.signUpEmail({ body: { email, name, password } })
    userId = created.user.id
    console.log(`Uživatel vytvořen: ${email} (${userId})`)
  } else {
    console.log(`Uživatel už existuje: ${email} (${userId})`)
  }

  // Created through better-auth so the afterCreateOrganization hook seeds the číselníky.
  let org = await getOrgBySlug(orgSlug)
  if (org === null) {
    await auth.api.createOrganization({ body: { name: orgName, slug: orgSlug, userId } })
    org = await getOrgBySlug(orgSlug)
    if (org === null) {
      throw new Error(`Workspace '${orgSlug}' se nepodařilo založit.`)
    }

    console.log(`Workspace založen: ${orgName} (${orgSlug})`)
  }

  await db
    .insert(organizationMembers)
    .values({ id: createId("om"), organizationId: org.id, userId, role: "owner" })
    .onConflictDoNothing({ target: [organizationMembers.organizationId, organizationMembers.userId] })
  console.log(`Členství owner ve workspace '${orgSlug}' zajištěno`)

  // Backfill stays global on purpose: legacy activities carry actor_type='user' with a
  // null actor_user_id across every org, and this bootstrap owns the single admin identity.
  const backfilled = await db
    .update(activities)
    .set({ actorUserId: userId })
    .where(and(eq(activities.actorType, "user"), isNull(activities.actorUserId)))
    .returning({ id: activities.id })
  console.log(`Doplněno actor_user_id u ${backfilled.length} aktivit`)

  console.log("Hotovo")
}

main()
  .then(() => getSql().end())
  .catch(async (error: unknown) => {
    console.error("Bootstrap selhal:", error)
    await getSql().end()
    process.exit(1)
  })
