import Link from "next/link"
import { CalendarClock, TicketCheck } from "lucide-react"
import { Card, CardHeader } from "@/app/_ui/Card"
import { Badge } from "@/app/_ui/Badge"
import { orgHref } from "@/lib/nav"
import type { TodayTicket } from "@/lib/crm/store/today"

function MoreLink({ href, hidden }: { href: string; hidden: number }) {
  if (hidden <= 0) {
    return null
  }

  return (
    <Link
      href={href}
      className="cursor-pointer border-t border-hairline px-6 py-3 text-xs font-medium text-muted transition-colors hover:text-primary"
    >
      a další {hidden}
    </Link>
  )
}

interface TodayPanelProps {
  orgSlug: string
  tickets: TodayTicket[]
  ticketsTotal: number
}

export function TodayPanel({ orgSlug, tickets, ticketsTotal }: TodayPanelProps) {
  const href = orgHref(orgSlug, "/ukoly")

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <CalendarClock className="size-4 text-muted-soft" />
        <h2 className="text-[13px] font-semibold uppercase tracking-wide text-muted-soft">
          Dnešní den
        </h2>
      </div>
      <Card className="flex flex-col">
        <CardHeader>
          <Link
            href={href}
            className="cursor-pointer text-[17px] font-semibold tracking-tight text-foreground transition-colors hover:text-primary"
          >
            Úkoly
          </Link>
          {ticketsTotal > 0 ? <Badge>{ticketsTotal}</Badge> : null}
        </CardHeader>
        {tickets.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-muted-soft">Žádné úkoly na dnes</p>
        ) : (
          <>
            <ul className="flex-1 divide-y divide-hairline">
              {tickets.map((ticket) => (
                <li key={ticket.id} className="flex items-center gap-3 px-6 py-3">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-muted">
                    <TicketCheck className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <Link
                      href={orgHref(orgSlug, `/ukoly?klient=${ticket.clientId}`)}
                      className="block cursor-pointer truncate text-sm font-medium text-foreground transition-colors hover:text-primary"
                    >
                      {ticket.title}
                    </Link>
                    <Link
                      href={orgHref(orgSlug, `/klienti/${ticket.clientId}`)}
                      className="block cursor-pointer truncate text-xs text-muted transition-colors hover:text-foreground"
                    >
                      {ticket.clientName}
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
            <MoreLink href={href} hidden={ticketsTotal - tickets.length} />
          </>
        )}
      </Card>
    </section>
  )
}
