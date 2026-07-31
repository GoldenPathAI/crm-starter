import type { ReactNode } from "react"
import Link from "next/link"
import {
  CircleDollarSign,
  Flame,
  PartyPopper,
  TicketCheck,
  type LucideIcon,
} from "lucide-react"
import type { OverdueTicketItem, StuckDealItem } from "@/lib/crm/store/dashboard"
import type { EnumOption } from "@/core/types/crm.types"
import { badgeStyleFor, styleMap } from "@/lib/crm/config"
import { Card, CardHeader, CardTitle } from "@/app/_ui/Card"
import { Badge } from "@/app/_ui/Badge"
import { EmptyState } from "@/app/_ui/EmptyState"
import { cn } from "@/lib/cn"
import { orgHref } from "@/lib/nav"
import { dayWord, formatCzk } from "./format"

interface HotListProps {
  orgSlug: string
  overdueTickets: OverdueTicketItem[]
  stuckDeals: StuckDealItem[]
  dealStageOptions: EnumOption[]
  ticketPriorityOptions: EnumOption[]
}

function SectionLabel({ children }: { children: string }) {
  return (
    <div className="bg-surface-2/50 px-6 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-soft">
      {children}
    </div>
  )
}

function Row({
  orgSlug,
  icon: Icon,
  iconClass,
  title,
  titleHref,
  clientName,
  clientId,
  badge,
  metric,
}: {
  orgSlug: string
  icon: LucideIcon
  iconClass: string
  title: string
  titleHref: string
  clientName: string
  clientId: string
  badge?: ReactNode
  metric: ReactNode
}) {
  return (
    <li className="flex items-center gap-3 px-6 py-3">
      <span
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-lg",
          iconClass,
        )}
      >
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <Link
            href={titleHref}
            className="truncate text-sm font-medium text-foreground transition-colors hover:text-primary"
          >
            {title}
          </Link>
          {badge}
        </div>
        <Link
          href={orgHref(orgSlug, `/klienti/${clientId}`)}
          className="text-xs text-muted transition-colors hover:text-foreground"
        >
          {clientName}
        </Link>
      </div>
      <div className="shrink-0 text-right">{metric}</div>
    </li>
  )
}

export function HotList({
  orgSlug,
  overdueTickets,
  stuckDeals,
  dealStageOptions,
  ticketPriorityOptions,
}: HotListProps) {
  const total = overdueTickets.length + stuckDeals.length
  const dealStageStyles = styleMap(dealStageOptions)
  const ticketPriorityStyles = styleMap(ticketPriorityOptions)

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div className="flex items-center gap-2.5">
          <span
            className={cn(
              "flex size-7 items-center justify-center rounded-lg",
              total > 0 ? "bg-red-soft text-red-text" : "bg-green-soft text-green-text",
            )}
          >
            <Flame className="size-4" />
          </span>
          <CardTitle>Co hoří</CardTitle>
        </div>
        {total > 0 ? <Badge className="bg-red-soft text-red-text">{total}</Badge> : null}
      </CardHeader>

      {total === 0 ? (
        <EmptyState
          icon={<PartyPopper className="size-6" />}
          title="Nic nehoří"
          description="Žádné úkoly po termínu ani zaseklé dealy."
        />
      ) : (
        <div className="divide-y divide-hairline">
          {overdueTickets.length > 0 ? (
            <div>
              <SectionLabel>Úkoly po termínu</SectionLabel>
              <ul className="divide-y divide-hairline">
                {overdueTickets.map((ticket) => (
                  <Row
                    key={ticket.id}
                    orgSlug={orgSlug}
                    icon={TicketCheck}
                    iconClass="bg-red-soft text-red-text"
                    title={ticket.title}
                    titleHref={orgHref(orgSlug, "/ukoly?zobrazit=po-terminu")}
                    clientName={ticket.clientName}
                    clientId={ticket.clientId}
                    badge={
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                          badgeStyleFor(ticket.priority, ticketPriorityStyles).badge,
                        )}
                      >
                        {badgeStyleFor(ticket.priority, ticketPriorityStyles).label}
                      </span>
                    }
                    metric={
                      <span className="text-xs font-medium tabular-nums text-danger">
                        {ticket.daysOverdue} {dayWord(ticket.daysOverdue)} po termínu
                      </span>
                    }
                  />
                ))}
              </ul>
            </div>
          ) : null}

          {stuckDeals.length > 0 ? (
            <div>
              <SectionLabel>Dealy bez pohybu</SectionLabel>
              <ul className="divide-y divide-hairline">
                {stuckDeals.map((deal) => (
                  <Row
                    key={deal.id}
                    orgSlug={orgSlug}
                    icon={CircleDollarSign}
                    iconClass="bg-orange-soft text-orange-text"
                    title={deal.title}
                    titleHref={orgHref(orgSlug, "/pipeline")}
                    clientName={deal.clientName}
                    clientId={deal.clientId}
                    badge={
                      <span
                        className={cn(
                          "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                          badgeStyleFor(deal.stage, dealStageStyles).badge,
                        )}
                      >
                        {badgeStyleFor(deal.stage, dealStageStyles).label}
                      </span>
                    }
                    metric={
                      <>
                        <span className="block text-sm font-semibold tabular-nums text-foreground">
                          {formatCzk(deal.valueCzk)}
                        </span>
                        <span className="block text-[11px] text-warning">
                          {deal.reason === "no_next_step"
                            ? "bez dalšího kroku"
                            : `${deal.daysInStage} ${dayWord(deal.daysInStage)} beze změny`}
                        </span>
                      </>
                    }
                  />
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      )}
    </Card>
  )
}
