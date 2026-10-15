import { redirect } from "next/navigation"
import { getSessionUser } from "@/lib/auth/orgContext"
import { listUserMemberships } from "@/lib/crm/store/members"
import { orgHref } from "@/lib/nav"

export default async function RootPage() {
  const user = await getSessionUser()
  if (user === null) {
    redirect("/login")
  }

  const memberships = await listUserMemberships(user.id)
  const first = memberships[0]
  if (first === undefined) {
    redirect("/no-access")
  }

  redirect(orgHref(first.slug, "/prehled"))
}
