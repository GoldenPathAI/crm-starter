import { requireOrgContext } from "@/lib/auth/orgContext"
import { getOrgSettings } from "@/lib/crm/store/orgSettings"
import { Card, CardContent, CardHeader, CardTitle } from "@/app/_ui/Card"
import { OrgSettingsForm } from "./OrgSettingsForm"

export async function OrgSection({ orgSlug }: { orgSlug: string }) {
  const ctx = await requireOrgContext(orgSlug)
  const settings = await getOrgSettings(ctx.scope.orgId)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Organizace</CardTitle>
      </CardHeader>
      <CardContent>
        <OrgSettingsForm
          orgSlug={orgSlug}
          orgName={ctx.org.name}
          orgSlugValue={ctx.org.slug}
          settings={settings}
          isOwner={ctx.role === "owner"}
        />
      </CardContent>
    </Card>
  )
}
