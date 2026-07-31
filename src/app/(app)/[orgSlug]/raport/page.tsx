import { PageHeader } from "@/app/_ui/PageHeader"
import { PageShell } from "@/app/_ui/PageShell"
import { applyDefaultSavedView } from "@/app/_lib/defaultView"
import { requireOrgContext } from "@/lib/auth/org-context"
import { loadOrgEnums } from "@/lib/crm/enums/service"
import { listClients } from "@/lib/crm/queries"
import { listRapportPeople } from "@/lib/crm/store/people"
import { SortDirection } from "@/core/types/query.types"
import {
  parseRaportGroups,
  parseRaportQuery,
  type RaportSearchParams,
} from "./_lib/parseRaportQuery"
import { NewPersonButton } from "./_components/NewPersonButton"
import { PeopleTable } from "./_components/PeopleTable"

export const dynamic = "force-dynamic"

interface RaportPageProps {
  params: Promise<{ orgSlug: string }>
  searchParams: Promise<RaportSearchParams>
}

export default async function RaportPage({ params, searchParams }: RaportPageProps) {
  const { orgSlug } = await params
  const ctx = await requireOrgContext(orgSlug)
  const resolvedParams = await searchParams
  await applyDefaultSavedView(ctx, orgSlug, "raport", resolvedParams)

  const query = parseRaportQuery(resolvedParams)
  const groups = parseRaportGroups(resolvedParams)
  const [enums, rows, clients] = await Promise.all([
    loadOrgEnums(ctx.scope.orgId),
    listRapportPeople(ctx.scope, query),
    listClients(ctx.scope, { filters: {}, page: 1, group: "status" }),
  ])

  const clientOptions = clients.items
    .map((client) => ({ id: client.id, name: client.name }))
    .sort((a, b) => a.name.localeCompare(b.name, "cs"))

  return (
    <PageShell wide className="gap-5">
      <PageHeader
        title="Raport"
        description="Lidé a drobnosti, na kterých se staví dlouhodobá důvěra"
        actions={
          <NewPersonButton
            orgSlug={orgSlug}
            kindOptions={enums.person_kind}
            clientOptions={clientOptions}
          />
        }
      />

      <PeopleTable
        orgSlug={orgSlug}
        rows={rows}
        kinds={query.kinds ?? []}
        search={query.q ?? ""}
        sortField={query.sort?.field}
        sortDir={query.sort?.direction ?? SortDirection.Asc}
        groups={groups}
        kindOptions={enums.person_kind}
        entryKindOptions={enums.rapport_entry_kind}
        clientOptions={clientOptions}
      />
    </PageShell>
  )
}
