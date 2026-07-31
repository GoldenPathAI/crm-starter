import { History, Mail, Phone, Send, StickyNote, Users, type LucideIcon } from "lucide-react"
import { cn } from "@/lib/cn"
import type { Activity, ActivityType } from "@/core/types/crm.types"
import { badgeFor, type EnumView } from "../_lib/enums"

export const ACTIVITY_ICON: Readonly<Record<ActivityType, LucideIcon>> = {
  poznamka: StickyNote,
  hovor: Phone,
  schuzka: Users,
  email_out: Send,
  email_in: Mail,
  system: History,
}

export const actorLabel = (
  actorType: Activity["actorType"],
  actorName?: string,
): string => {
  if (actorType === "ai") {
    return "AI asistent"
  }
  if (actorType === "system") {
    return "Systém"
  }
  return actorName ?? "Uživatel"
}

interface ActivityIconProps {
  type: ActivityType
  view: EnumView
  className?: string
}

export function ActivityIcon({ type, view, className }: ActivityIconProps) {
  const Icon = ACTIVITY_ICON[type] ?? History
  return (
    <span
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-full",
        badgeFor(view, type).badge,
        className,
      )}
    >
      <Icon className="size-4" />
    </span>
  )
}
