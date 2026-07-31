"use client"

import { useState } from "react"
import { ChevronDown, ChevronRight } from "lucide-react"
import { Button } from "@/app/_ui/Button"
import { Card, CardContent } from "@/app/_ui/Card"
import type { Activity } from "@/core/types/crm.types"
import { normalizeActivityBody } from "@/lib/crm/activities/body"
import { ActivityIcon } from "../../_components/activity"
import { type EnumView } from "../../_lib/enums"
import { relativeDate } from "../../_lib/format"
import { buildTimeline, type TimelineItem } from "../_lib/timeline"
import { ActivityDetailDialog } from "./ActivityDetailDialog"
import { LogActivityMenu } from "./ClientActions"

// A long-running client carries hundreds of rows; cap the first paint and let the
// user expand instead.
const TIMELINE_CAP = 25

// The row shows one calm line of preview text: the body flattened to a single line
// and clamped by the row.
const previewText = (item: TimelineItem): string | undefined => {
  if (item.body === undefined) {
    return undefined
  }
  return normalizeActivityBody(item.body).replace(/\s+/g, " ").trim()
}

interface ActivityTimelinePanelProps {
  clientId: string
  activities: Activity[]
  activityTypeView: EnumView
}

export function ActivityTimelinePanel({
  clientId,
  activities,
  activityTypeView,
}: ActivityTimelinePanelProps) {
  const [showAll, setShowAll] = useState(false)
  const [openItemId, setOpenItemId] = useState<string | null>(null)
  const timeline = buildTimeline(activities)
  const capped = !showAll && timeline.length > TIMELINE_CAP
  const visible = capped ? timeline.slice(0, TIMELINE_CAP) : timeline
  const openItem = timeline.find((item) => item.id === openItemId) ?? null

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardContent className="py-6">
          <div className="mb-4 flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-foreground">Časová osa</h3>
            <LogActivityMenu clientId={clientId} />
          </div>
          {timeline.length > 0 ? (
            <ol className="flex flex-col">
              {visible.map((item, index) => (
                <TimelineRow
                  key={item.id}
                  item={item}
                  last={index === visible.length - 1}
                  view={activityTypeView}
                  onOpen={setOpenItemId}
                />
              ))}
            </ol>
          ) : (
            <p className="py-6 text-center text-[13px] text-muted-soft">Žádná aktivita</p>
          )}
          {timeline.length > TIMELINE_CAP ? (
            <div className="flex justify-center border-t border-hairline pt-4">
              <Button variant="ghost" size="sm" onClick={() => setShowAll((value) => !value)}>
                {showAll ? (
                  <>
                    <ChevronDown className="size-4 rotate-180" />
                    Zobrazit méně
                  </>
                ) : (
                  <>
                    <ChevronDown className="size-4" />
                    Zobrazit vše ({timeline.length})
                  </>
                )}
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <ActivityDetailDialog
        item={openItem}
        clientId={clientId}
        activityTypeView={activityTypeView}
        onClose={() => setOpenItemId(null)}
      />
    </div>
  )
}

function TimelineRow({
  item,
  last,
  view,
  onOpen,
}: {
  item: TimelineItem
  last: boolean
  view: EnumView
  onOpen: (id: string) => void
}) {
  const preview = previewText(item)

  return (
    <li className="group relative pb-2 last:pb-0">
      {!last ? (
        <span
          aria-hidden
          className="absolute left-4 top-9 h-[calc(100%-1.25rem)] w-px -translate-x-1/2 bg-border"
        />
      ) : null}
      <button
        type="button"
        onClick={() => onOpen(item.id)}
        className="-mx-2 flex w-[calc(100%+1rem)] cursor-pointer items-start gap-4 rounded-xl px-2 py-2 text-left transition-colors hover:bg-surface-2/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ActivityIcon type={item.type} view={view} className="relative z-10" />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5 pt-0.5">
          <div className="flex items-baseline justify-between gap-3">
            <span className="truncate text-sm font-medium text-foreground">{item.title}</span>
            <span className="shrink-0 text-xs tabular-nums text-muted-soft">
              {relativeDate(item.occurredAt)}
            </span>
          </div>
          {preview !== undefined ? (
            <span className="line-clamp-2 text-[13px] leading-relaxed text-muted">{preview}</span>
          ) : null}
          <span className="text-xs text-muted-soft">{item.actorLabel}</span>
        </div>
        <ChevronRight className="mt-2 size-4 shrink-0 text-muted-soft opacity-0 transition-opacity group-hover:opacity-100" />
      </button>
    </li>
  )
}
