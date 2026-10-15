import { HttpError } from "./http"
import { listOrgMembers } from "@/lib/crm/store/members"

// Machine callers address members by e-mail (user ids differ per environment); resolve
// them to user ids and reject unknown addresses so a typo never silently drops an
// assignee.
export async function resolveAssigneeUserIds(
  orgId: string,
  emails: string[] | undefined,
): Promise<string[] | undefined> {
  if (emails === undefined || emails.length === 0) {
    return undefined
  }

  const members = await listOrgMembers(orgId)
  const byEmail = new Map(members.map((member) => [member.email.toLowerCase(), member.userId]))

  return emails.map((email) => {
    const userId = byEmail.get(email.trim().toLowerCase())
    if (userId === undefined) {
      throw new HttpError(400, `Uživatel ${email} není členem workspace.`)
    }

    return userId
  })
}
