"use client"

import { useActionState, useEffect, useState, useTransition, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { CalendarClock } from "lucide-react"
import { Button } from "@/app/_ui/Button"
import { ConfirmDialog } from "@/app/_ui/ConfirmDialog"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/app/_ui/Dialog"
import { Field } from "@/app/_ui/Field"
import { Input } from "@/app/_ui/Input"
import { Markdown } from "@/app/_ui/Markdown"
import { Spinner } from "@/app/_ui/Spinner"
import { Textarea } from "@/app/_ui/Textarea"
import { ToastVariant, useToast } from "@/app/_ui/Toast"
import { idleState } from "@/app/_lib/actionState"
import { useUndoToast } from "@/app/_lib/useUndoToast"
import { useOrg } from "@/app/_components/org/OrgProvider"
import { normalizeActivityBody } from "@/lib/crm/activities/body"
import { ActivityIcon } from "@/app/(app)/[orgSlug]/klienti/_components/activity"
import { type EnumView } from "@/app/(app)/[orgSlug]/klienti/_lib/enums"
import { deleteActivityAction, updateActivityAction } from "../actions"
import type { TimelineItem } from "../_lib/timeline"

const formatDateTime = (iso: string): string =>
  new Intl.DateTimeFormat("cs-CZ", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Prague",
  }).format(new Date(iso))

const typeLabel = (view: EnumView, item: TimelineItem): string =>
  view.options.find((option) => option.value === item.type)?.label ?? item.type

interface ActivityDetailDialogProps {
  item: TimelineItem | null
  clientId: string
  activityTypeView: EnumView
  onClose: () => void
}

export function ActivityDetailDialog({
  item,
  clientId,
  activityTypeView,
  onClose,
}: ActivityDetailDialogProps) {
  return (
    <Dialog open={item !== null} onOpenChange={(open) => (open ? null : onClose())}>
      {item !== null ? (
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <div className="flex items-start gap-3 pr-4">
              <ActivityIcon type={item.type} view={activityTypeView} className="mt-0.5" />
              <div className="flex min-w-0 flex-col gap-1.5">
                <DialogTitle>{item.title}</DialogTitle>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-soft">
                  <span className="flex items-center gap-1">
                    <CalendarClock className="size-3.5" />
                    <span className="tabular-nums">{formatDateTime(item.occurredAt)}</span>
                  </span>
                  <span className="rounded-full bg-surface-3/70 px-2 py-0.5 text-[11px] font-medium text-muted">
                    {typeLabel(activityTypeView, item)}
                  </span>
                  <span>{item.actorLabel}</span>
                </div>
              </div>
            </div>
          </DialogHeader>

          <ActivityDetail item={item} clientId={clientId} onClose={onClose} />
        </DialogContent>
      ) : null}
    </Dialog>
  )
}

function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-soft">
      {children}
    </h4>
  )
}

function ActivityDetail({
  item,
  clientId,
  onClose,
}: {
  item: TimelineItem
  clientId: string
  onClose: () => void
}) {
  const body = item.body !== undefined ? normalizeActivityBody(item.body) : undefined

  return (
    <div className="flex flex-col gap-5">
      <section>
        <SectionHeading>Záznam</SectionHeading>
        {body !== undefined ? (
          <Markdown text={body} />
        ) : (
          <p className="text-[13px] text-muted-soft">Záznam nemá text</p>
        )}
      </section>

      {item.editable ? (
        <ActivityDetailFooter item={item} clientId={clientId} onClose={onClose} />
      ) : null}
    </div>
  )
}

function ActivityDetailFooter({
  item,
  clientId,
  onClose,
}: {
  item: TimelineItem
  clientId: string
  onClose: () => void
}) {
  const { orgSlug } = useOrg()
  const { toast } = useToast()
  const { toastWithUndo } = useUndoToast()
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const remove = () => {
    startTransition(async () => {
      const result = await deleteActivityAction(orgSlug, item.id, clientId)
      if (result.status === "success") {
        onClose()
        toastWithUndo(result, () => router.refresh())
        router.refresh()
      } else if (result.status === "error") {
        toast({ variant: ToastVariant.Error, title: result.message })
      }
    })
  }

  return (
    <DialogFooter className="border-t border-hairline pt-4 sm:justify-between">
      <ConfirmDialog
        trigger={
          <Button type="button" variant="ghost" size="sm" disabled={pending} className="text-danger hover:bg-danger-soft">
            Smazat
          </Button>
        }
        title="Smazat aktivitu"
        description={`Záznam "${item.title}" bude odebrán z časové osy. Akci nelze vrátit.`}
        confirmLabel="Smazat"
        destructive
        onConfirm={remove}
      />
      <EditActivityDialog item={item} clientId={clientId} />
    </DialogFooter>
  )
}

function EditActivityDialog({
  item,
  clientId,
}: {
  item: TimelineItem
  clientId: string
}) {
  const { orgSlug } = useOrg()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [state, formAction, pending] = useActionState(
    updateActivityAction.bind(null, orgSlug),
    idleState,
  )
  const { toast } = useToast()

  useEffect(() => {
    if (state.status === "success") {
      toast({ variant: ToastVariant.Success, title: state.message })
      setOpen(false)
      router.refresh()
    } else if (state.status === "error") {
      toast({ variant: ToastVariant.Error, title: state.message })
    }
  }, [state, toast, router])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="secondary" size="sm">
          Upravit
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upravit aktivitu</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="activityId" value={item.id} />
          <input type="hidden" name="clientId" value={clientId} />
          <Field label="Nadpis" htmlFor={`activity-title-${item.id}`} required>
            <Input
              id={`activity-title-${item.id}`}
              name="title"
              defaultValue={item.title}
              required
              autoComplete="off"
            />
          </Field>
          <Field label="Text" htmlFor={`activity-body-${item.id}`}>
            <Textarea
              id={`activity-body-${item.id}`}
              name="body"
              rows={8}
              defaultValue={item.body !== undefined ? normalizeActivityBody(item.body) : undefined}
            />
          </Field>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost" size="sm">
                Zrušit
              </Button>
            </DialogClose>
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? <Spinner className="size-4" /> : null}
              Uložit změny
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
