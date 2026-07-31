import Link from "next/link"
import { Plus } from "lucide-react"
import { PageHeader } from "@/app/_ui/PageHeader"
import { PageShell } from "@/app/_ui/PageShell"
import { Button } from "@/app/_ui/Button"
import { listProjects } from "@/lib/crm/queries"
import { requireOrgContext } from "@/lib/auth/org-context"
import { loadOrgEnums } from "@/lib/crm/enums/service"
import { orgHref } from "@/lib/nav"
import { parseGroupLevels } from "@/app/_components/browser/queryHelpers"
import { applyDefaultSavedView } from "@/app/_lib/defaultView"
import { SortDirection } from "@/core/types/query.types"
import type { ProjectListItem } from "@/lib/crm/queries"
import {
  ProjectsTable,
  type ProjectGroupValue,
  type ProjectSortField,
} from "./_components/ProjectsTable"

export const dynamic = "force-dynamic"

type SearchParams = Record<string, string | string[] | undefined>

const SORT_FIELDS: ReadonlyArray<ProjectSortField> = ["name", "due", "status"]
const GROUP_VALUES: ReadonlyArray<ProjectGroupValue> = ["status", "klient"]

const single = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value

const parseStatuses = (
  value: string | string[] | undefined,
  allowed: readonly string[],
): string[] => {
  const raw = Array.isArray(value) ? value : value !== undefined ? [value] : []
  const matched = raw
    .flatMap((entry) => entry.split(","))
    .map((entry) => entry.trim())
    .filter((entry) => allowed.includes(entry))
  return [...new Set(matched)]
}

const compareProjects = (
  a: ProjectListItem,
  b: ProjectListItem,
  field: ProjectSortField,
  direction: SortDirection,
  statusValues: readonly string[],
): number => {
  const factor = direction === SortDirection.Desc ? -1 : 1
  if (field === "name") {
    return factor * a.name.localeCompare(b.name, "cs")
  }
  if (field === "status") {
    return factor * (statusValues.indexOf(a.status) - statusValues.indexOf(b.status))
  }
  return factor * (a.dueAt ?? "9999").localeCompare(b.dueAt ?? "9999")
}

export default async function ProjektyPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>
  searchParams: Promise<SearchParams>
}) {
  const { orgSlug } = await params
  const ctx = await requireOrgContext(orgSlug)
  const query = await searchParams
  await applyDefaultSavedView(ctx, orgSlug, "projekty", query)
  const enums = await loadOrgEnums(ctx.scope.orgId)
  const statusOptions = enums.project_status
  const statusValues = statusOptions.map((option) => option.value)
  const doneValue = statusOptions.find((option) => option.semantic === "done")?.value ?? ""

  const statuses = parseStatuses(query.status, statusValues)
  const q = single(query.q)?.trim() ?? ""
  const sortFieldRaw = single(query.sortField)
  const sortField = SORT_FIELDS.find((field) => field === sortFieldRaw)
  const sortDir = single(query.sortDir) === SortDirection.Desc ? SortDirection.Desc : SortDirection.Asc
  const groups = parseGroupLevels(query.group, GROUP_VALUES, { default: [], maxLevels: 2 })

  const all = await listProjects(ctx.scope)
  const needle = q.toLowerCase()

  const rows = all
    .filter((project) => (statuses.length > 0 ? statuses.includes(project.status) : true))
    .filter((project) =>
      needle.length > 0
        ? `${project.name} ${project.clientName}`.toLowerCase().includes(needle)
        : true,
    )
    .sort((a, b) => (sortField !== undefined ? compareProjects(a, b, sortField, sortDir, statusValues) : 0))

  return (
    <PageShell wide className="gap-8">
      <PageHeader
        title="Projekty"
        description="Projekty napříč klienty a jejich úkoly"
        actions={
          <Button asChild size="sm">
            <Link href={orgHref(ctx.org.slug, "/projekty/novy")}>
              <Plus className="size-4" />
              Nový projekt
            </Link>
          </Button>
        }
      />
      <ProjectsTable
        rows={rows}
        statuses={statuses}
        statusOptions={statusOptions}
        doneValue={doneValue}
        q={q}
        sortField={sortField}
        sortDir={sortDir}
        groups={groups}
      />
    </PageShell>
  )
}
