"use client"

import { formatDistanceToNow, parseISO } from "date-fns"
import { cs } from "date-fns/locale"
import { Bell } from "lucide-react"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useRef, useState } from "react"
import { useOrg } from "@/app/_components/org/OrgProvider"
import { Popover, PopoverContent, PopoverTrigger } from "@/app/_ui/Popover"
import { Spinner } from "@/app/_ui/Spinner"
import { cn } from "@/lib/cn"
import { orgHref } from "@/lib/nav"
import type { Notification, NotificationEntityType } from "@/core/types/crm.types"
import {
  fetchNotificationsAction,
  markAllNotificationsReadAction,
  markNotificationReadAction,
  unreadCountAction,
} from "@/app/_components/notifications/actions"

const POLL_INTERVAL_MS = 60_000

const entityPath = (
  entityType: NotificationEntityType | undefined,
  entityId: string | undefined,
): string | null => {
  if (entityType === undefined) {
    return null
  }

  switch (entityType) {
    case "ticket":
      return entityId !== undefined ? `/ukoly?ukol=${entityId}` : "/ukoly"
    case "deal":
      return entityId !== undefined ? `/pipeline?deal=${entityId}` : "/pipeline"
    case "client":
      return entityId !== undefined ? `/klienti/${entityId}` : "/klienti"
    case "project":
      return entityId !== undefined ? `/projekty/${entityId}` : "/projekty"
  }
}

const relativeTime = (iso: string): string =>
  formatDistanceToNow(parseISO(iso), { addSuffix: true, locale: cs })

const bellAriaLabel = (unread: number): string => {
  if (unread === 0) {
    return "Notifikace"
  }

  if (unread === 1) {
    return "Notifikace, 1 nepřečtená"
  }

  if (unread <= 4) {
    return `Notifikace, ${unread} nepřečtené`
  }

  return `Notifikace, ${unread} nepřečtených`
}

export function NotificationsBell() {
  const { orgSlug } = useOrg()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<Notification[]>([])
  const [hasLoaded, setHasLoaded] = useState(false)
  const [unread, setUnread] = useState(0)
  const openRef = useRef(open)
  openRef.current = open

  const refreshCount = useCallback(async (): Promise<void> => {
    const count = await unreadCountAction(orgSlug)
    setUnread(count)
  }, [orgSlug])

  const loadList = useCallback(async (): Promise<void> => {
    const snapshot = await fetchNotificationsAction(orgSlug)
    setItems(snapshot.items)
    setUnread(snapshot.unread)
    setHasLoaded(true)
  }, [orgSlug])

  useEffect(() => {
    void refreshCount()
    const timer = setInterval(() => {
      // Skip while open: the open list already refreshes and owns the count.
      if (!openRef.current) {
        void refreshCount()
      }
    }, POLL_INTERVAL_MS)

    return () => clearInterval(timer)
  }, [refreshCount])

  const onOpenChange = (next: boolean): void => {
    setOpen(next)
    if (next) {
      void loadList()
    }
  }

  const onItemClick = async (item: Notification): Promise<void> => {
    setOpen(false)
    if (item.readAt === undefined) {
      setItems((current) =>
        current.map((entry) =>
          entry.id === item.id ? { ...entry, readAt: new Date().toISOString() } : entry,
        ),
      )
      const count = await markNotificationReadAction(orgSlug, item.id)
      setUnread(count)
    }

    const path = entityPath(item.entityType, item.entityId)
    if (path !== null) {
      router.push(orgHref(orgSlug, path))
    }
  }

  const onMarkAll = async (): Promise<void> => {
    setItems((current) =>
      current.map((entry) =>
        entry.readAt === undefined ? { ...entry, readAt: new Date().toISOString() } : entry,
      ),
    )
    setUnread(0)
    await markAllNotificationsReadAction(orgSlug)
  }

  const badge = unread > 9 ? "9+" : String(unread)

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={bellAriaLabel(unread)}
          className="relative flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
        >
          <Bell className="size-4" strokeWidth={2} />
          {unread > 0 ? (
            <span className="absolute -right-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-semibold leading-4 text-primary-foreground">
              {badge}
            </span>
          ) : null}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[320px] p-0">
        <div className="flex items-center justify-between px-3 py-2">
          <span className="text-[13px] font-semibold tracking-tight text-foreground">Notifikace</span>
          {unread > 0 ? (
            <span className="text-[11px] text-muted">{unread} nepřečtených</span>
          ) : null}
        </div>
        <div className="max-h-[360px] overflow-y-auto border-t border-hairline">
          {!hasLoaded ? (
            <div className="flex items-center justify-center px-3 py-6">
              <Spinner className="size-4 text-muted-soft" />
            </div>
          ) : items.length === 0 ? (
            <p className="px-3 py-6 text-center text-[12px] text-muted">Žádné notifikace</p>
          ) : (
            items.map((item) => {
              const clickable = entityPath(item.entityType, item.entityId) !== null

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => void onItemClick(item)}
                  className={cn(
                    "flex w-full items-start gap-2.5 px-3 py-2 text-left transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                    clickable ? "cursor-pointer" : "cursor-default",
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "mt-1.5 size-1.5 shrink-0 rounded-full",
                      item.readAt === undefined ? "bg-primary" : "bg-transparent",
                    )}
                  />
                  {item.readAt === undefined ? (
                    <span className="sr-only">nepřečtené</span>
                  ) : null}
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-[13px] font-medium text-foreground">
                      {item.title}
                    </span>
                    {item.body !== undefined ? (
                      <span className="truncate text-[12px] text-muted">{item.body}</span>
                    ) : null}
                    <span className="text-[11px] text-muted-soft">{relativeTime(item.createdAt)}</span>
                  </span>
                </button>
              )
            })
          )}
        </div>
        {items.length > 0 ? (
          <div className="border-t border-hairline p-1.5">
            <button
              type="button"
              onClick={() => void onMarkAll()}
              disabled={unread === 0}
              className="flex w-full cursor-pointer items-center justify-center rounded-lg px-2 py-1.5 text-[12px] font-medium text-muted transition-colors hover:bg-surface-2 hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
            >
              Označit vše jako přečtené
            </button>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  )
}
