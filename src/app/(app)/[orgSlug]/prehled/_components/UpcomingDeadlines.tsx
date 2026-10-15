import Link from "next/link"
import { CalendarClock, FolderKanban, TicketCheck, type LucideIcon } from "lucide-react"
import type { UpcomingDeadline } from "@/lib/crm/store/dashboard"
import { Card, CardHeader, CardTitle } from "@/app/_ui/Card"
import { Badge } from "@/app/_ui/Badge"
import { EmptyState } from "@/app/_ui/EmptyState"
import { cn } from "@/lib/cn"
import { orgHref } from "@/lib/nav"
import { formatDueRelative } from "./format"

const WEEK_WINDOW_DAYS = 7
const MAX_ROWS = 7

const kindIcon: Readonly<Record<UpcomingDeadline["kind"], LucideIcon>> = {
  ticket: TicketCheck,
  project: FolderKanban,
}

const deadlineHref = (orgSlug: string, deadline: UpcomingDeadline): string =>
  orgHref(
    orgSlug,
    deadline.kind === "project"
      ? `/projekty/${deadline.id}`
      : `/ukoly?klient=${deadline.clientId}`,
  )

const toneClasses = (daysUntil: number): string => {
  if (daysUntil <= 1) {
    return "text-warning"
  }

  return "text-muted"
}

interface UpcomingDeadlinesProps {
  orgSlug: string
  deadlines: UpcomingDeadline[]
}

export function UpcomingDeadlines({ orgSlug, deadlines }: UpcomingDeadlinesProps) {
  const thisWeek = deadlines.filter((deadline) => deadline.daysUntil <= WEEK_WINDOW_DAYS)
  const shown = thisWeek.slice(0, MAX_ROWS)
  const hiddenCount = thisWeek.length - shown.length

  return (
    <Card className="flex h-full flex-col">
      <CardHeader>
        <CardTitle>Tento týden</CardTitle>
        {thisWeek.length > 0 ? <Badge>{thisWeek.length}</Badge> : null}
      </CardHeader>
      {shown.length === 0 ? (
        <EmptyState
          icon={<CalendarClock className="size-6" />}
          title="Tento týden nic nehoří"
          description="V příštích 7 dnech nemáte žádné termíny úkolů ani projektů."
        />
      ) : (
        <>
          <ul className="flex-1 divide-y divide-hairline">
            {shown.map((deadline) => {
              const Icon = kindIcon[deadline.kind]

              return (
                <li
                  key={`${deadline.kind}-${deadline.id}`}
                  className="flex items-center gap-3 px-6 py-3.5"
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-muted">
                    <Icon className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <Link
                      href={deadlineHref(orgSlug, deadline)}
                      className="block truncate text-sm font-medium text-foreground transition-colors hover:text-primary"
                    >
                      {deadline.title}
                    </Link>
                    <Link
                      href={orgHref(orgSlug, `/klienti/${deadline.clientId}`)}
                      className="text-xs text-muted transition-colors hover:text-foreground"
                    >
                      {deadline.clientName}
                    </Link>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 text-xs font-medium tabular-nums",
                      toneClasses(deadline.daysUntil),
                    )}
                  >
                    {formatDueRelative(deadline.daysUntil)}
                  </span>
                </li>
              )
            })}
          </ul>
          {hiddenCount > 0 ? (
            <Link
              href={orgHref(orgSlug, "/ukoly")}
              className="border-t border-hairline px-6 py-3 text-xs font-medium text-muted transition-colors hover:text-primary"
            >
              a další {hiddenCount} v tomto týdnu
            </Link>
          ) : null}
        </>
      )}
    </Card>
  )
}
