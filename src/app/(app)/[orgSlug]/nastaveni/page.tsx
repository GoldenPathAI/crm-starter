import { requireOrgContext } from "@/lib/auth/org-context"
import { PageHeader } from "@/app/_ui/PageHeader"
import { CommandsPanel } from "./_components/CommandsPanel"
import { DbStatusPanel } from "./_components/DbStatusPanel"
import { EnumsSection } from "./_components/enums/EnumsSection"
import { HistoryPanel } from "./_components/history/HistoryPanel"
import { MembersPanel } from "./_components/members/MembersPanel"
import { OrgSection } from "./_components/org/OrgSection"
import { SettingsTabs } from "./_components/SettingsTabs"
import { SETTINGS_TAB_KEYS, type SettingsTabKey } from "./_components/settingsTabKeys"
import { getCrmDbStatus, getInternalApiStatus } from "./_lib/status"

export const dynamic = "force-dynamic"

export default async function NastaveniPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { orgSlug } = await params
  const ctx = await requireOrgContext(orgSlug)

  const dbStatus = await getCrmDbStatus()
  const internalApi = getInternalApiStatus()

  const resolvedSearchParams = await searchParams
  const tabParam = Array.isArray(resolvedSearchParams.tab)
    ? resolvedSearchParams.tab[0]
    : resolvedSearchParams.tab
  const initialTab: SettingsTabKey = SETTINGS_TAB_KEYS.find((key) => key === tabParam) ?? "clenove"
  const entityParam = Array.isArray(resolvedSearchParams.entity)
    ? resolvedSearchParams.entity[0]
    : resolvedSearchParams.entity

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Nastavení" description="Členové, číselníky a data" />
      <SettingsTabs
        initialTab={initialTab}
        panels={{
          clenove: (
            <MembersPanel
              orgSlug={orgSlug}
              orgId={ctx.scope.orgId}
              viewerRole={ctx.role}
              viewerUserId={ctx.user.id}
            />
          ),
          ciselniky: <EnumsSection orgSlug={orgSlug} />,
          organizace: <OrgSection orgSlug={orgSlug} />,
          data: (
            <div className="flex flex-col gap-6">
              <DbStatusPanel db={dbStatus} internalApi={internalApi} />
              <CommandsPanel />
            </div>
          ),
          historie: <HistoryPanel orgSlug={orgSlug} entity={entityParam} />,
        }}
      />
    </div>
  )
}
