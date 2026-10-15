"use client"

import * as TooltipPrimitive from "@radix-ui/react-tooltip"
import type { OrgMember } from "@/core/types/crm.types"
import { Avatar, type AvatarSize } from "@/app/_ui/Avatar"
import { cn } from "@/lib/cn"

interface AvatarStackProps {
  members: OrgMember[]
  size?: AvatarSize
  max?: number
  className?: string
}

const OVERFLOW_SIZE: Record<AvatarSize, string> = {
  sm: "size-6 text-[10px]",
  md: "size-9 text-xs",
}

export function AvatarStack({ members, size = "sm", max = 3, className }: AvatarStackProps) {
  if (members.length === 0) {
    return null
  }

  const visible = members.slice(0, max)
  const overflow = members.length - visible.length
  const names = members.map((member) => member.name).join(", ")

  return (
    <TooltipPrimitive.Provider delayDuration={200}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>
          <span className={cn("flex items-center", className)}>
            {visible.map((member) => (
              <Avatar
                key={member.userId}
                name={member.name}
                userId={member.userId}
                size={size}
                className="-ml-1.5 ring-2 ring-surface first:ml-0"
              />
            ))}
            {overflow > 0 ? (
              <span
                className={cn(
                  "-ml-1.5 inline-flex shrink-0 items-center justify-center rounded-full bg-surface-3/80 font-semibold text-muted ring-2 ring-surface",
                  OVERFLOW_SIZE[size],
                )}
              >
                +{overflow}
              </span>
            ) : null}
          </span>
        </TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            sideOffset={6}
            className="z-50 max-w-64 rounded-lg border border-hairline bg-surface px-2.5 py-1.5 text-xs font-medium text-foreground shadow-lifted"
          >
            {names}
            <TooltipPrimitive.Arrow className="fill-surface" />
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  )
}
