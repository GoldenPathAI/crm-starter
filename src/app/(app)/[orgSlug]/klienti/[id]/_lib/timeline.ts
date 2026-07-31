import type { Activity, ActivityType } from "@/core/types/crm.types"
import { actorLabel } from "../../_components/activity"

// Only hand-logged activities can be edited or deleted from the timeline; system
// rows are a record of what happened and stay read-only.
const EDITABLE_ACTIVITY_TYPES: ReadonlySet<ActivityType> = new Set([
  "poznamka",
  "hovor",
  "schuzka",
])

export interface TimelineItem {
  id: string
  type: ActivityType
  title: string
  body?: string
  occurredAt: string
  actorLabel: string
  editable: boolean
}

export const buildTimeline = (activities: Activity[]): TimelineItem[] =>
  activities
    .map((activity) => ({
      id: activity.id,
      type: activity.type,
      title: activity.title,
      body: activity.body,
      occurredAt: activity.occurredAt,
      actorLabel: actorLabel(activity.actorType, activity.actorName),
      editable: activity.actorType === "user" && EDITABLE_ACTIVITY_TYPES.has(activity.type),
    }))
    .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
