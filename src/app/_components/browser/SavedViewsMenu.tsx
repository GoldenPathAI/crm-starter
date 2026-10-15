"use client"

import { useEffect, useState } from "react"
import { Bookmark, Check, ChevronDown, Star, Trash2 } from "lucide-react"
import { Button } from "@/app/_ui/Button"
import { Input } from "@/app/_ui/Input"
import { Popover, PopoverContent, PopoverTrigger } from "@/app/_ui/Popover"
import { cn } from "@/lib/cn"
import type { SavedView } from "./savedViews"
import {
  deleteSavedViewAction,
  listSavedViewsAction,
  saveSavedViewAction,
  setDefaultSavedViewAction,
} from "./savedViewsActions"

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg"

interface SavedViewsMenuProps {
  orgSlug: string
  pageKey: string
  // Normalized query of the current browser state ("" = default/empty state).
  currentQuery: string
  onApply: (query: string) => void
}

export function SavedViewsMenu({ orgSlug, pageKey, currentQuery, onApply }: SavedViewsMenuProps) {
  const [open, setOpen] = useState(false)
  const [views, setViews] = useState<SavedView[]>([])
  const [name, setName] = useState("")
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)

  // Views are user-scoped in Postgres: one indexed load per (org, page) mount.
  useEffect(() => {
    let active = true
    listSavedViewsAction(orgSlug, pageKey)
      .then(({ views: next }) => {
        if (active) {
          setViews(next)
        }
      })
      .catch(() => {
        if (active) {
          setViews([])
        }
      })

    return () => {
      active = false
    }
  }, [orgSlug, pageKey])

  const activeView =
    currentQuery.length > 0 ? views.find((view) => view.query === currentQuery) : undefined

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen)
    setPendingDeleteId(null)
  }

  const trimmedName = name.trim()
  const canSave = trimmedName.length > 0 && currentQuery.length > 0

  const handleSave = () => {
    if (!canSave) {
      return
    }

    void saveSavedViewAction(orgSlug, pageKey, trimmedName, currentQuery).then(({ views: next }) =>
      setViews(next),
    )
    setName("")
  }

  // Toggling the star makes the view the user's default for this page (applied on
  // every bare visit) or clears it. One default per page, the server swaps it.
  const handleDefaultToggle = (view: SavedView) => {
    void setDefaultSavedViewAction(orgSlug, pageKey, view.id, !view.isDefault).then(
      ({ views: next }) => setViews(next),
    )
  }

  const handleDeleteClick = (view: SavedView) => {
    if (pendingDeleteId === view.id) {
      void deleteSavedViewAction(orgSlug, pageKey, view.id).then(({ views: next }) =>
        setViews(next),
      )
      setPendingDeleteId(null)
    } else {
      setPendingDeleteId(view.id)
    }
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium transition-colors duration-150",
            focusRing,
            activeView !== undefined
              ? "border-primary/30 bg-primary-soft text-primary"
              : "border-border bg-surface text-muted hover:border-border-strong hover:text-foreground",
          )}
        >
          <Bookmark className="size-3.5" />
          {activeView !== undefined ? `Pohled: ${activeView.name}` : "Pohledy"}
          <ChevronDown className="size-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-0">
        {views.length === 0 ? (
          <p className="px-3 py-3 text-sm text-muted">Zatím žádné uložené pohledy</p>
        ) : (
          <div className="flex max-h-72 flex-col gap-0.5 overflow-y-auto p-1.5">
            {views.map((view) => {
              const active = activeView?.id === view.id
              const deletePending = pendingDeleteId === view.id

              return (
                <div key={view.id} className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      onApply(view.query)
                      setOpen(false)
                    }}
                    className={cn(
                      "flex min-w-0 flex-1 cursor-pointer items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors",
                      focusRing,
                      active ? "bg-primary-soft text-primary" : "text-foreground hover:bg-surface-2",
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span className="truncate">{view.name}</span>
                      {view.isDefault ? (
                        <span className="shrink-0 rounded-full bg-surface-3/70 px-1.5 py-0.5 text-[11px] font-medium text-muted">
                          Výchozí
                        </span>
                      ) : null}
                    </span>
                    {active ? <Check className="size-4 shrink-0" /> : null}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDefaultToggle(view)}
                    aria-label={
                      view.isDefault
                        ? `Zrušit výchozí pohled ${view.name}`
                        : `Nastavit ${view.name} jako výchozí pohled`
                    }
                    title={view.isDefault ? "Zrušit výchozí pohled" : "Nastavit jako výchozí"}
                    className={cn(
                      "flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors",
                      focusRing,
                      view.isDefault
                        ? "text-primary hover:bg-primary-soft"
                        : "text-muted-soft hover:bg-surface-3/60 hover:text-foreground",
                    )}
                  >
                    <Star className={cn("size-3.5", view.isDefault && "fill-current")} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteClick(view)}
                    aria-label={deletePending ? "Opravdu smazat?" : `Smazat pohled ${view.name}`}
                    title={deletePending ? "Opravdu smazat?" : `Smazat pohled ${view.name}`}
                    className={cn(
                      "flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors",
                      focusRing,
                      deletePending
                        ? "bg-red-soft text-red-text"
                        : "text-muted-soft hover:bg-surface-3/60 hover:text-foreground",
                    )}
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              )
            })}
          </div>
        )}
        <div className="flex flex-col gap-2 border-t border-hairline p-3">
          <span className="text-xs font-medium text-muted">Uložit aktuální pohled</span>
          <div className="flex items-center gap-2">
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault()
                  handleSave()
                }
              }}
              placeholder="Název pohledu"
              aria-label="Název pohledu"
              disabled={currentQuery.length === 0}
              className="h-8 rounded-lg px-2.5 text-sm"
            />
            <Button size="sm" onClick={handleSave} disabled={!canSave} className="shrink-0">
              Uložit
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
