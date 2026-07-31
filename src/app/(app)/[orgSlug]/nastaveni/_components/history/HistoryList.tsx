"use client"

import { useRouter } from "next/navigation"
import { useTransition } from "react"
import { History, Undo2 } from "lucide-react"
import { Button } from "@/app/_ui/Button"
import { EmptyState } from "@/app/_ui/EmptyState"
import { Spinner } from "@/app/_ui/Spinner"
import { useToast } from "@/app/_ui/Toast"
import { undoUiAction } from "@/app/_lib/undoActions"
import { cn } from "@/lib/cn"
import { HistoryFilter, type EntityFilterOption } from "./HistoryFilter"
import type { HistoryBatchView } from "./historyView"

interface HistoryListProps {
  orgSlug: string
  batches: readonly HistoryBatchView[]
  filterValue: string
  filterOptions: readonly EntityFilterOption[]
}

const OPERATION_TONE: Readonly<Record<HistoryBatchView["entries"][number]["operation"], string>> = {
  INSERT: "text-green-text",
  UPDATE: "text-muted",
  DELETE: "text-danger",
}

export function HistoryList({ orgSlug, batches, filterValue, filterOptions }: HistoryListProps) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[13px] text-muted">Posledních 50 změn v tomto pracovním prostoru</p>
        <HistoryFilter orgSlug={orgSlug} value={filterValue} options={filterOptions} />
      </div>

      {batches.length === 0 ? (
        <div className="overflow-hidden rounded-2xl border border-hairline bg-surface shadow-soft">
          <EmptyState
            icon={<History className="size-6" />}
            title="Žádná historie"
            description="Jakmile se něco změní, uvidíte tady kdo a co upravil."
          />
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {batches.map((batch) => (
            <HistoryBatchCard key={batch.key} orgSlug={orgSlug} batch={batch} />
          ))}
        </div>
      )}
    </div>
  )
}

function HistoryBatchCard({ orgSlug, batch }: { orgSlug: string; batch: HistoryBatchView }) {
  const router = useRouter()
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()

  const undo = () => {
    if (batch.requestId === null) {
      return
    }
    const requestId = batch.requestId
    startTransition(async () => {
      const result = await undoUiAction(orgSlug, requestId)
      if (result.status === "success") {
        toast({ variant: "success", title: result.message })
        router.refresh()
      } else if (result.status === "error") {
        toast({ variant: "error", title: result.message })
      }
    })
  }

  return (
    <div className="rounded-2xl border border-hairline bg-surface shadow-soft">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline px-5 py-3">
        <div className="flex flex-wrap items-center gap-2 text-[13px]">
          <span className="font-medium text-foreground">{batch.actorLabel}</span>
          <span className="inline-flex items-center rounded-full bg-surface-2 px-2 py-0.5 text-[12px] font-medium text-muted">
            {batch.sourceLabel}
          </span>
          <span className="text-muted-soft">·</span>
          <span className="text-muted" title={batch.createdAt}>
            {batch.createdLabel}
          </span>
        </div>
        {batch.undone ? (
          <span className="inline-flex items-center rounded-full bg-surface-2 px-2.5 py-0.5 text-[12px] font-medium text-muted-soft">
            Vráceno
          </span>
        ) : batch.undoable ? (
          <Button size="sm" variant="ghost" onClick={undo} disabled={isPending}>
            {isPending ? <Spinner className="size-4" /> : <Undo2 className="size-4" />}
            Vrátit zpět
          </Button>
        ) : null}
      </div>
      <ul className="flex flex-col divide-y divide-hairline">
        {batch.entries.map((entry) => (
          <li key={entry.id} className="flex flex-wrap items-baseline gap-x-2 gap-y-1 px-5 py-2.5">
            <span className={cn("text-[13px] font-medium", OPERATION_TONE[entry.operation])}>
              {entry.entity} {entry.verb}
            </span>
            <span className="text-[13px] text-foreground">{entry.name}</span>
            {entry.changes.length > 0 ? (
              <span className="text-[12px] text-muted-soft">{entry.changes}</span>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  )
}
