import { PageHeader } from "@/app/_ui/PageHeader"
import { listClients } from "@/lib/crm/store/clients"
import { requireOrgContext } from "@/lib/auth/orgContext"
import { loadOrgEnums } from "@/lib/crm/enums/service"
import { orgHref } from "@/lib/nav"
import type { ProjectFormValues } from "../_components/ProjectFormFields"
import type { FormSelectOption } from "../_components/types"
import { NewProjectForm } from "./_components/NewProjectForm"

export const dynamic = "force-dynamic"

type SearchParams = Record<string, string | string[] | undefined>

const single = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value

export default async function NewProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>
  searchParams: Promise<SearchParams>
}) {
  const { orgSlug } = await params
  const ctx = await requireOrgContext(orgSlug)
  const query = await searchParams
  const enums = await loadOrgEnums(ctx.scope.orgId)
  const { items } = await listClients(ctx.scope, { filters: {}, page: 1, group: "status" })
  const clientOptions: FormSelectOption[] = items
    .map((client) => ({ value: client.id, label: client.name }))
    .sort((a, b) => a.label.localeCompare(b.label, "cs"))

  const clientIdParam = single(query.clientId)
  const clientId =
    clientIdParam !== undefined && items.some((client) => client.id === clientIdParam)
      ? clientIdParam
      : ""
  const nameParam = single(query.name)
  const budgetParam = single(query.budget)
  const budget =
    budgetParam !== undefined ? budgetParam.replace(/\D/g, "") : ""
  const dealId = single(query.dealId) ?? ""

  const prefill: Partial<ProjectFormValues> = {
    clientId,
    name: nameParam ?? "",
    budget,
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Nový projekt"
        description="Založte projekt a začněte přidávat úkoly"
        breadcrumb={[{ label: "Projekty", href: orgHref(ctx.org.slug, "/projekty") }]}
      />
      <NewProjectForm
        clientOptions={clientOptions}
        statusOptions={enums.project_status}
        prefill={prefill}
        dealId={dealId}
      />
    </div>
  )
}
