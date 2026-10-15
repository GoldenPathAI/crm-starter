import { format } from "date-fns"
import { cs } from "date-fns/locale"
import { getDashboardData } from "@/lib/crm/queries"
import { requireOrgContext } from "@/lib/auth/org-context"
import { loadOrgEnums } from "@/lib/crm/enums/service"
import { loadTodayPanel } from "@/lib/crm/store/today"
import { PageShell } from "@/app/_ui/PageShell"
import { DashboardStats } from "./_components/DashboardStats"
import { TodayPanel } from "./_components/TodayPanel"
import { HotList } from "./_components/HotList"
import { UpcomingDeadlines } from "./_components/UpcomingDeadlines"
import { formatDeals, ticketWord } from "./_components/format"

export const dynamic = "force-dynamic"

const greetingFor = (hour: number): string => {
  if (hour < 12) {
    return "Dobré ráno"
  }

  if (hour < 18) {
    return "Dobré odpoledne"
  }

  return "Dobrý večer"
}

const capitalize = (value: string): string =>
  value.length > 0 ? value.charAt(0).toUpperCase() + value.slice(1) : value

export default async function PrehledPage({
  params,
}: {
  params: Promise<{ orgSlug: string }>
}) {
  const { orgSlug } = await params
  const ctx = await requireOrgContext(orgSlug)
  const data = await getDashboardData(ctx.scope)
  const enums = await loadOrgEnums(ctx.scope.orgId)
  const todayPanel = await loadTodayPanel(ctx.scope)
  const now = new Date()
  const greeting = greetingFor(now.getHours())
  const dateLabel = capitalize(format(now, "EEEE d. MMMM yyyy", { locale: cs }))

  const hotParts: string[] = []
  if (data.overdueTickets.length > 0) {
    hotParts.push(`${data.overdueTickets.length} ${ticketWord(data.overdueTickets.length)} po termínu`)
  }

  if (data.stuckDeals.length > 0) {
    hotParts.push(`${data.stuckDeals.length} ${formatDeals(data.stuckDeals.length)} bez pohybu`)
  }

  const statusLine = hotParts.length === 0 ? "Nic nehoří" : hotParts.join(" · ")

  return (
    <PageShell wide className="gap-8">
      <header className="flex flex-col gap-2">
        <span className="text-[13px] font-medium text-muted-soft">{dateLabel}</span>
        <h1 className="text-[28px] font-semibold tracking-tight text-foreground">
          {greeting}
        </h1>
        <p className="text-[15px] text-muted">{statusLine}</p>
      </header>

      <DashboardStats
        activeClientsCount={data.activeClientsCount}
        mrrCzk={data.mrrCzk}
        openDealsCount={data.openDealsCount}
        openPipelineCzk={data.openPipelineCzk}
        weightedPipelineCzk={data.weightedPipelineCzk}
      />

      <TodayPanel
        orgSlug={ctx.org.slug}
        tickets={todayPanel.tickets}
        ticketsTotal={todayPanel.ticketsTotal}
      />

      <HotList
        orgSlug={ctx.org.slug}
        overdueTickets={data.overdueTickets}
        stuckDeals={data.stuckDeals}
        dealStageOptions={enums.deal_stage}
        ticketPriorityOptions={enums.ticket_priority}
      />

      <UpcomingDeadlines orgSlug={ctx.org.slug} deadlines={data.upcomingDeadlines} />
    </PageShell>
  )
}
