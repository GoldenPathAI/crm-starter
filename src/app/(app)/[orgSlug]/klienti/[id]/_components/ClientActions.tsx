"use client"

import { forwardRef, useActionState, useEffect, useRef, useState } from "react"
import { Phone, Plus, StickyNote, Users, type LucideIcon } from "lucide-react"
import { Button } from "@/app/_ui/Button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/app/_ui/Dialog"
import { Field } from "@/app/_ui/Field"
import { Input } from "@/app/_ui/Input"
import { Popover, PopoverContent, PopoverTrigger } from "@/app/_ui/Popover"
import { Spinner } from "@/app/_ui/Spinner"
import { Textarea } from "@/app/_ui/Textarea"
import { ToastVariant, useToast } from "@/app/_ui/Toast"
import { idleState } from "@/app/_lib/actionState"
import { useOrg } from "@/app/_components/org/OrgProvider"
import { addClientActivityAction } from "../actions"
import { ACTIVITY_KINDS, type ActivityKind } from "../_lib/activityKinds"

interface DialogCopy {
  label: string
  icon: LucideIcon
  title: string
  titleLabel: string
  titlePlaceholder: string
  bodyLabel: string
  bodyPlaceholder: string
  submit: string
}

const COPY: Readonly<Record<ActivityKind, DialogCopy>> = {
  hovor: {
    label: "Zalogovat hovor",
    icon: Phone,
    title: "Zalogovat hovor",
    titleLabel: "Předmět hovoru",
    titlePlaceholder: "Úvodní call k automatizaci fakturace",
    bodyLabel: "Poznámka z hovoru",
    bodyPlaceholder: "O čem jste se bavili, co bylo domluveno",
    submit: "Zalogovat",
  },
  schuzka: {
    label: "Zalogovat schůzku",
    icon: Users,
    title: "Zalogovat schůzku",
    titleLabel: "Předmět schůzky",
    titlePlaceholder: "Kickoff k automatizaci fakturace",
    bodyLabel: "Poznámka ze schůzky",
    bodyPlaceholder: "Kdo byl, co bylo domluveno, další kroky",
    submit: "Zalogovat",
  },
  poznamka: {
    label: "Přidat poznámku",
    icon: StickyNote,
    title: "Přidat poznámku",
    titleLabel: "Nadpis",
    titlePlaceholder: "Klient chce demo do konce týdne",
    bodyLabel: "Text poznámky",
    bodyPlaceholder: "Detaily, kontext, další kroky",
    submit: "Uložit poznámku",
  },
}

const CardIconButton = forwardRef<
  HTMLButtonElement,
  { label: string } & React.ButtonHTMLAttributes<HTMLButtonElement>
>(function CardIconButton({ label, ...props }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      title={label}
      className="flex size-8 cursor-pointer items-center justify-center rounded-full text-muted-soft transition-colors hover:bg-surface-3/60 hover:text-foreground"
      {...props}
    >
      <Plus className="size-4" />
    </button>
  )
})

export function AddNoteButton({ clientId }: { clientId: string }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <CardIconButton label="Přidat poznámku" onClick={() => setOpen(true)} />
      <ActivityDialog clientId={clientId} kind="poznamka" open={open} onOpenChange={setOpen} />
    </>
  )
}

export function LogActivityMenu({ clientId }: { clientId: string }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [dialogKind, setDialogKind] = useState<ActivityKind | null>(null)

  return (
    <>
      <Popover open={menuOpen} onOpenChange={setMenuOpen}>
        <PopoverTrigger asChild>
          <CardIconButton label="Zalogovat aktivitu" />
        </PopoverTrigger>
        <PopoverContent align="end" className="w-56">
          {ACTIVITY_KINDS.map((kind) => {
            const copy = COPY[kind]
            const Icon = copy.icon

            return (
              <button
                key={kind}
                type="button"
                onClick={() => {
                  setMenuOpen(false)
                  setDialogKind(kind)
                }}
                className="flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] text-foreground transition-colors hover:bg-surface-3/60"
              >
                <Icon className="size-4 text-muted" />
                {copy.label}
              </button>
            )
          })}
        </PopoverContent>
      </Popover>
      {dialogKind !== null ? (
        <ActivityDialog
          clientId={clientId}
          kind={dialogKind}
          open
          onOpenChange={(next) => {
            if (!next) {
              setDialogKind(null)
            }
          }}
        />
      ) : null}
    </>
  )
}

function ActivityDialog({
  clientId,
  kind,
  open,
  onOpenChange,
}: {
  clientId: string
  kind: ActivityKind
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const copy = COPY[kind]
  const Icon = copy.icon
  const { orgSlug } = useOrg()
  const [state, formAction, pending] = useActionState(
    addClientActivityAction.bind(null, orgSlug),
    idleState,
  )
  const { toast } = useToast()
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (state.status === "success") {
      toast({ variant: ToastVariant.Success, title: state.message })
      onOpenChange(false)
      formRef.current?.reset()
    } else if (state.status === "error") {
      toast({ variant: ToastVariant.Error, title: state.message })
    }
  }, [state, toast, onOpenChange])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
        </DialogHeader>
        <form ref={formRef} action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="clientId" value={clientId} />
          <input type="hidden" name="type" value={kind} />
          <Field label={copy.titleLabel} htmlFor={`${kind}-title`} required>
            <Input
              id={`${kind}-title`}
              name="title"
              placeholder={copy.titlePlaceholder}
              required
              autoComplete="off"
            />
          </Field>
          <Field label={copy.bodyLabel} htmlFor={`${kind}-body`}>
            <Textarea
              id={`${kind}-body`}
              name="body"
              rows={4}
              placeholder={copy.bodyPlaceholder}
              className="min-h-24"
            />
          </Field>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost" size="sm">
                Zrušit
              </Button>
            </DialogClose>
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? <Spinner className="size-4" /> : <Icon className="size-4" />}
              {copy.submit}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
