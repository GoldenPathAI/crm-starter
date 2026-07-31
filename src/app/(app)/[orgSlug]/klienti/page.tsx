import Link from "next/link"
import { UserPlus } from "lucide-react"
import { Button } from "@/app/_ui/Button"
import { PageHeader } from "@/app/_ui/PageHeader"
import { PageShell } from "@/app/_ui/PageShell"
import { listClients } from "@/lib/crm/queries"
import { loadOrgEnums } from "@/lib/crm/enums/service"
import { requireOrgContext } from "@/lib/auth/org-context"
import { applyDefaultSavedView } from "@/app/_lib/defaultView"
import { orgHref } from "@/lib/nav"
import { parsePageSize } from "@/lib/pageSize"
import { toEnumView, type EnumView } from "./_lib/enums"
import {
  parseClientGroups,
  parseClientQuery,
  type ClientSearchParams,
} from "./_lib/parseClientQuery"
import { ClientsTable, type FilterOption } from "./_components/ClientsTable"

export const dynamic = "force-dynamic"

// The resting view hides ended clients and groups by status. A bare URL renders these
// defaults directly (a server redirect here left a blank gap between the skeleton and
// the content, because the second, same-segment navigation has no loading boundary)
// and ClientsTable writes them into the address bar shallowly, so the user can still
// override them (uncheck the filter, ungroup) without the defaults snapping back. The
// "ended" set is org-driven via the client_status option carrying the `ended` semantic.
const defaultClientsParams = (statusView: EnumView): Record<string, string> => {
  const activeStatuses = statusView.options
    .filter((option) => option.semantic !== "ended")
    .map((option) => option.value)
  return { group: "status", status: activeStatuses.join(",") }
}

interface KlientiPageProps {
  params: Promise<{ orgSlug: string }>
  searchParams: Promise<ClientSearchParams>
}

export default async function KlientiPage({ params, searchParams }: KlientiPageProps) {
  const { orgSlug } = await params
  const ctx = await requireOrgContext(orgSlug)
  // A user's default saved view takes over the bare URL (server redirect to the
  // stored query) before the resting defaults below kick in for everyone else.
  const resolvedParams = await searchParams
  await applyDefaultSavedView(ctx, orgSlug, "klienti", resolvedParams)
  const enums = await loadOrgEnums(ctx.scope.orgId)
  const statusView = toEnumView(enums.client_status)
  const serviceView = toEnumView(enums.service_kind)

  const defaults = defaultClientsParams(statusView)
  const bareUrl = Object.keys(resolvedParams).length === 0
  const effectiveParams: ClientSearchParams = bareUrl ? defaults : resolvedParams
  const query = parseClientQuery(effectiveParams)
  const groups = parseClientGroups(effectiveParams)
  const grouped = groups.length > 0

  const [pageResult, allClients] = await Promise.all([
    listClients(ctx.scope, {
      ...query,
      // The store returns ALL matching rows whenever `group` is set; the Browser
      // buckets them client-side per level, so the primary level is enough here.
      ...(grouped ? { group: groups[0] } : {}),
      pageSize: parsePageSize(effectiveParams.pageSize),
    }),
    listClients(ctx.scope, { filters: {}, page: 1, group: "industry" }),
  ])

  const industryOptions: FilterOption[] = [
    ...new Set(allClients.items.map((client) => client.industry)),
  ]
    .sort((a, b) => a.localeCompare(b, "cs"))
    .map((industry) => ({ value: industry, label: industry }))

  const labelOptions: FilterOption[] = [
    ...new Set(allClients.items.flatMap((client) => client.labels)),
  ]
    .sort((a, b) => a.localeCompare(b, "cs"))
    .map((label) => ({ value: label, label }))

  return (
    <PageShell wide className="gap-5">
      <PageHeader
        title="Klienti"
        description="Firmy, se kterými spolupracujeme, a jejich stav"
        actions={
          <Button asChild size="sm">
            <Link href={orgHref(ctx.org.slug, "/klienti/novy")}>
              <UserPlus className="size-4" />
              Nový klient
            </Link>
          </Button>
        }
      />

      <ClientsTable
        rows={pageResult.items}
        total={pageResult.total}
        page={pageResult.page}
        pageSize={pageResult.pageSize}
        sort={query.sort}
        filters={query.filters}
        groups={groups}
        industryOptions={industryOptions}
        labelOptions={labelOptions}
        statusView={statusView}
        serviceView={serviceView}
        canonicalSearch={bareUrl ? new URLSearchParams(defaults).toString() : undefined}
      />
    </PageShell>
  )
}
