"use client"

import { useState, useTransition } from "react"
import { Check, Pencil, X } from "lucide-react"
import type { OrgSettings } from "@/core/types/crm.types"
import { cn } from "@/lib/cn"
import { Button } from "@/app/_ui/Button"
import { Input } from "@/app/_ui/Input"
import { Label } from "@/app/_ui/Label"
import { Spinner } from "@/app/_ui/Spinner"
import { useToast } from "@/app/_ui/Toast"
import { updateOrganizationNameAction, updateOrgSettingsAction } from "./actions"

export function OrgSettingsForm({
  orgSlug,
  orgName,
  orgSlugValue,
  settings,
  isOwner,
}: {
  orgSlug: string
  orgName: string
  orgSlugValue: string
  settings: OrgSettings
  isOwner: boolean
}) {
  const { toast } = useToast()

  return (
    <div className="flex max-w-xl flex-col gap-6">
      <NameField orgSlug={orgSlug} orgName={orgName} isOwner={isOwner} onToast={toast} />

      <div className="flex flex-col gap-2">
        <Label htmlFor="org-slug">Identifikátor</Label>
        <Input id="org-slug" value={orgSlugValue} readOnly disabled className="font-mono" />
        <p className="text-xs text-muted">Identifikátor nelze po vytvoření změnit</p>
      </div>

      <SettingsFields orgSlug={orgSlug} settings={settings} isOwner={isOwner} onToast={toast} />
    </div>
  )
}

function NameField({
  orgSlug,
  orgName,
  isOwner,
  onToast,
}: {
  orgSlug: string
  orgName: string
  isOwner: boolean
  onToast: ReturnType<typeof useToast>["toast"]
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(orgName)
  const [pending, startTransition] = useTransition()

  const cancel = () => {
    setDraft(orgName)
    setEditing(false)
  }

  const save = () => {
    const trimmed = draft.trim()
    if (trimmed.length === 0 || trimmed === orgName) {
      cancel()

      return
    }

    startTransition(async () => {
      const result = await updateOrganizationNameAction(orgSlug, trimmed)
      if (result.status === "success") {
        onToast({ variant: "success", title: result.message })
        setEditing(false)
      } else if (result.status === "error") {
        onToast({ variant: "error", title: result.message })
      }
    })
  }

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor="org-name">Název</Label>
      {editing && isOwner ? (
        <div className="flex items-center gap-2">
          <Input
            id="org-name"
            autoFocus
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault()
                save()
              } else if (event.key === "Escape") {
                event.preventDefault()
                cancel()
              }
            }}
          />
          <Button type="button" size="icon" variant="secondary" onClick={save} disabled={pending} aria-label="Uložit">
            {pending ? <Spinner className="size-4" /> : <Check className="size-4" />}
          </Button>
          <Button type="button" size="icon" variant="ghost" onClick={cancel} aria-label="Zrušit">
            <X className="size-4" />
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <span className="flex h-11 flex-1 items-center rounded-xl border border-transparent px-4 text-[15px] text-foreground">
            {orgName}
          </span>
          {isOwner ? (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={() => setEditing(true)}
              aria-label="Upravit název"
            >
              <Pencil className="size-4" />
            </Button>
          ) : null}
        </div>
      )}
    </div>
  )
}

function SettingsFields({
  orgSlug,
  settings,
  isOwner,
  onToast,
}: {
  orgSlug: string
  settings: OrgSettings
  isOwner: boolean
  onToast: ReturnType<typeof useToast>["toast"]
}) {
  const [staleDealDays, setStaleDealDays] = useState(String(settings.staleDealDays))
  const [pending, startTransition] = useTransition()

  const parsedDays = Number.parseInt(staleDealDays, 10)
  const daysValid = !Number.isNaN(parsedDays) && parsedDays >= 1
  const dirty = daysValid && parsedDays !== settings.staleDealDays

  const save = () => {
    if (!daysValid) {
      return
    }

    startTransition(async () => {
      const result = await updateOrgSettingsAction(orgSlug, { staleDealDays: parsedDays })
      if (result.status === "success") {
        onToast({ variant: "success", title: result.message })
      } else if (result.status === "error") {
        onToast({ variant: "error", title: result.message })
      }
    })
  }

  return (
    <div className="flex flex-col gap-6 border-t border-hairline pt-6">
      <div className="flex flex-col gap-2">
        <Label htmlFor="stale-days">Deal je zaseklý po (dní)</Label>
        <Input
          id="stale-days"
          inputMode="numeric"
          value={staleDealDays}
          disabled={!isOwner}
          onChange={(event) => setStaleDealDays(event.target.value.replace(/[^0-9]/g, ""))}
          className={cn("w-32", !daysValid && "border-danger")}
        />
      </div>

      {isOwner ? (
        <div className="flex justify-end">
          <Button type="button" onClick={save} disabled={!dirty || pending}>
            {pending ? <Spinner className="size-4" /> : null}
            Uložit
          </Button>
        </div>
      ) : null}
    </div>
  )
}
