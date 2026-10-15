import { PageHeader } from "@/app/_ui/PageHeader"
import { loadOrgEnums } from "@/lib/crm/enums/service"
import { requireOrgContext } from "@/lib/auth/orgContext"
import { orgHref } from "@/lib/nav"
import { toEnumView } from "../_lib/enums"
import { NewClientForm } from "./_components/NewClientForm"

export const dynamic = "force-dynamic"

interface NovyKlientPageProps {
  params: Promise<{ orgSlug: string }>
}

export default async function NovyKlientPage({ params }: NovyKlientPageProps) {
  const { orgSlug } = await params
  const ctx = await requireOrgContext(orgSlug)
  const enums = await loadOrgEnums(ctx.scope.orgId)

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <PageHeader
        title="Nový klient"
        description="Založ firmu a primární kontakt"
        breadcrumb={[
          { label: "Klienti", href: orgHref(ctx.org.slug, "/klienti") },
          { label: "Nový klient", href: orgHref(ctx.org.slug, "/klienti/novy") },
        ]}
      />
      <NewClientForm
        statusView={toEnumView(enums.client_status)}
        serviceView={toEnumView(enums.service_kind)}
      />
    </div>
  )
}
