"use client"

import { useActionState, useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { AlertTriangle, Pencil } from "lucide-react"
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
import { Spinner } from "@/app/_ui/Spinner"
import { ToastVariant, useToast } from "@/app/_ui/Toast"
import { idleState, type ActionState } from "@/app/_lib/actionState"
import { useUndoToast } from "@/app/_lib/useUndoToast"
import type { Client } from "@/core/types/crm.types"
import { orgHref } from "@/lib/nav"
import { useOrg } from "@/app/_components/org/OrgProvider"
import { ClientFormFields } from "@/app/(app)/[orgSlug]/klienti/_components/ClientFormFields"
import { type EnumView } from "@/app/(app)/[orgSlug]/klienti/_lib/enums"
import { deleteClientAction, endClientAction, updateClientAction } from "../actions"

interface EditClientDialogProps {
  client: Client
  hasRelated: boolean
  statusView: EnumView
  serviceView: EnumView
}

export function EditClientDialog({ client, hasRelated, statusView, serviceView }: EditClientDialogProps) {
  const [open, setOpen] = useState(false)
  const { toast } = useToast()
  const { toastWithUndo } = useUndoToast()
  const router = useRouter()
  const { orgSlug } = useOrg()
  const [state, formAction, pending] = useActionState(
    updateClientAction.bind(null, orgSlug),
    idleState,
  )
  const [dangerPending, startDanger] = useTransition()

  useEffect(() => {
    if (state.status === "success") {
      toast({ variant: ToastVariant.Success, title: state.message })
      setOpen(false)
    } else if (state.status === "error") {
      toast({ variant: ToastVariant.Error, title: state.message })
    }
  }, [state, toast])

  const runDanger = (action: () => Promise<ActionState>, redirect: boolean) =>
    new Promise<void>((resolve) => {
      startDanger(async () => {
        const result = await action()
        if (result.status === "success") {
          toastWithUndo(result, () => router.refresh())
          setOpen(false)
          if (redirect) {
            router.push(orgHref(orgSlug, "/klienti"))
          } else {
            router.refresh()
          }
        } else if (result.status === "error") {
          toast({ variant: ToastVariant.Error, title: result.message })
        }

        resolve()
      })
    })

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Pencil className="size-4" />
          Upravit
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Upravit klienta</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-5">
          <input type="hidden" name="clientId" value={client.id} />
          <ClientFormFields
            idPrefix={`edit-${client.id}`}
            statusView={statusView}
            serviceView={serviceView}
            initial={{
              name: client.name,
              industry: client.industry,
              street: client.street,
              city: client.city,
              zip: client.zip,
              ico: client.ico,
              dic: client.dic,
              website: client.website,
              billingEmail: client.billingEmail,
              status: client.status,
              services: client.services,
              mrrCzk: client.mrrCzk,
              nextStep: client.nextStep,
              note: client.note,
              labels: client.labels,
            }}
          />
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

        <div className="flex flex-col gap-3 rounded-xl border border-danger/20 bg-danger-soft/40 p-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-4 text-danger" />
            <span className="text-[13px] font-semibold text-foreground">Nebezpečná zóna</span>
          </div>
          {hasRelated ? (
            <>
              <p className="text-[13px] text-muted">
                Klient má navázané dealy, projekty, úkoly nebo dokumenty. Nelze ho smazat, jen
                ukončit spolupráci.
              </p>
              <ConfirmDialog
                trigger={
                  <Button variant="danger" size="sm" className="self-start" disabled={dangerPending}>
                    Ukončit spolupráci
                  </Button>
                }
                title="Ukončit spolupráci"
                description={`Status klienta ${client.name} se změní na Ukončený. Data zůstanou zachována.`}
                confirmLabel="Ukončit spolupráci"
                destructive
                onConfirm={() => runDanger(() => endClientAction(orgSlug, client.id), false)}
              />
            </>
          ) : (
            <>
              <p className="text-[13px] text-muted">
                Klient nemá žádné navázané dealy, projekty, úkoly ani dokumenty. Smazání je trvalé a
                odstraní i jeho kontaktní osoby a aktivitu.
              </p>
              <ConfirmDialog
                trigger={
                  <Button variant="danger" size="sm" className="self-start" disabled={dangerPending}>
                    Smazat klienta
                  </Button>
                }
                title="Smazat klienta"
                description={`Klient ${client.name} bude trvale smazán včetně kontaktů a aktivity. Akci nelze vrátit.`}
                confirmLabel="Smazat trvale"
                destructive
                onConfirm={() => runDanger(() => deleteClientAction(orgSlug, client.id), true)}
              />
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
