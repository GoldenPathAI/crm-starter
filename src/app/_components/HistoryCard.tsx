import Link from "next/link"
import { ArrowUpRight } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { cs } from "date-fns/locale"
import { Card, CardContent, CardHeader, CardTitle } from "@/app/_ui/Card"
import { cn } from "@/lib/cn"
import { humanizeEntry } from "@/lib/crm/audit/humanize"
import type { AuditEntry } from "@/lib/crm/audit/queries"

export interface HistoryItem {
  id: string
  entity: string
  verb: string
  name: string
  changes: string
  operation: AuditEntry["operation"]
  timeLabel: string
}

const OPERATION_TONE: Readonly<Record<AuditEntry["operation"], string>> = {
  INSERT: "text-green-text",
  UPDATE: "text-muted",
  DELETE: "text-danger",
}

// Pure, server-side transform. Kept out of the render so a page or server action can
// build the items list once and pass plain data into the card or section.
export const buildHistoryItems = (entries: readonly AuditEntry[]): HistoryItem[] =>
  entries.map((entry) => ({
    id: entry.id,
    operation: entry.operation,
    timeLabel: formatDistanceToNow(entry.createdAt, { locale: cs, addSuffix: true }),
    ...humanizeEntry(entry),
  }))

export function HistoryEntryRows({ items }: { items: readonly HistoryItem[] }) {
  return items.length > 0 ? (
    <>
      {items.map((item) => (
        <div key={item.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className={cn("text-[13px] font-medium", OPERATION_TONE[item.operation])}>
            {item.entity} {item.verb}
          </span>
          <span className="text-[13px] text-foreground">{item.name}</span>
          {item.changes.length > 0 ? (
            <span className="text-xs text-muted-soft">{item.changes}</span>
          ) : null}
          <span className="ml-auto shrink-0 text-xs text-muted-soft">{item.timeLabel}</span>
        </div>
      ))}
    </>
  ) : (
    <p className="text-[13px] text-muted-soft">Žádná historie</p>
  )
}

export function HistoryCard({
  items,
  historyHref,
}: {
  items: readonly HistoryItem[]
  historyHref: string
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Historie změn</CardTitle>
        <Link
          href={historyHref}
          className="inline-flex items-center gap-1 text-[13px] text-primary transition-colors hover:text-primary-hover"
        >
          Celá historie
          <ArrowUpRight className="size-3.5" />
        </Link>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <HistoryEntryRows items={items} />
      </CardContent>
    </Card>
  )
}
