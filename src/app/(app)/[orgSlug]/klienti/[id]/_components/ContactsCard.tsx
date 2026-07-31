"use client"

import { useActionState, useEffect, useOptimistic, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { HeartHandshake, Pencil, Plus, Star, Trash2 } from "lucide-react"
import { Button } from "@/app/_ui/Button"
import { Card, CardContent, CardHeader, CardTitle } from "@/app/_ui/Card"
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
import { Spinner } from "@/app/_ui/Spinner"
import { useToast } from "@/app/_ui/Toast"
import { idleState } from "@/app/_lib/actionState"
import { useUndoToast } from "@/app/_lib/useUndoToast"
import { cn } from "@/lib/cn"
import { useOrg } from "@/app/_components/org/OrgProvider"
import { PersonRapportDialog } from "@/app/_components/rapport/PersonRapportDialog"
import type { Client, EnumOption, Person } from "@/core/types/crm.types"
import {
  createPersonAction,
  deletePersonAction,
  setPrimaryPersonAction,
  updatePersonAction,
} from "../actions"
import { CopyButton } from "./CopyButton"

interface ContactsCardProps {
  client: Client
  people: Person[]
  personKindOptions: EnumOption[]
  rapportEntryKindOptions: EnumOption[]
}

export function ContactsCard({
  client,
  people,
  personKindOptions,
  rapportEntryKindOptions,
}: ContactsCardProps) {
  const clientId = client.id
  const { orgSlug } = useOrg()
  const { toast } = useToast()
  const router = useRouter()
  const [, startTransition] = useTransition()
  // The star fills (and the previous primary clears) instantly; server props
  // restore the persisted state when the transition ends.
  const [optimisticPeople, setOptimisticPrimary] = useOptimistic(
    people,
    (current: Person[], personId: string) =>
      current.map((person) => ({ ...person, isPrimary: person.id === personId })),
  )

  const setPrimary = (personId: string) => {
    startTransition(async () => {
      setOptimisticPrimary(personId)
      const result = await setPrimaryPersonAction(orgSlug, personId, clientId)
      if (result.status === "success") {
        router.refresh()
      } else if (result.status === "error") {
        toast({ variant: "error", title: result.message })
      }
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Kontaktní osoby</CardTitle>
        <AddPersonDialog clientId={clientId} />
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {optimisticPeople.length > 0 ? (
          optimisticPeople.map((person) => (
            <PersonRow
              key={person.id}
              person={person}
              clientId={clientId}
              clientName={client.name}
              personKindOptions={personKindOptions}
              rapportEntryKindOptions={rapportEntryKindOptions}
              onSetPrimary={() => setPrimary(person.id)}
            />
          ))
        ) : (
          <p className="text-[13px] text-muted-soft">Žádné kontaktní osoby</p>
        )}
      </CardContent>
    </Card>
  )
}

function PersonRow({
  person,
  clientId,
  clientName,
  personKindOptions,
  rapportEntryKindOptions,
  onSetPrimary,
}: {
  person: Person
  clientId: string
  clientName: string
  personKindOptions: EnumOption[]
  rapportEntryKindOptions: EnumOption[]
  onSetPrimary: () => void
}) {
  const { orgSlug } = useOrg()
  const { toast } = useToast()
  const { toastWithUndo } = useUndoToast()
  const router = useRouter()
  const [rapportOpen, setRapportOpen] = useState(false)

  return (
    <div className="flex items-start justify-between gap-3 border-b border-hairline pb-4 last:border-0 last:pb-0">
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[15px] font-medium text-foreground">{person.name}</span>
          {person.isPrimary ? (
            <span className="rounded-full bg-primary-soft px-2 py-0.5 text-[11px] font-medium text-primary">
              Primární kontakt
            </span>
          ) : null}
        </div>
        {person.role !== undefined ? (
          <span className="text-[13px] text-muted">{person.role}</span>
        ) : null}
        <div className="mt-0.5 flex flex-wrap gap-x-4 gap-y-1.5 text-[13px]">
          {person.email !== undefined ? (
            <span className="inline-flex items-center gap-1">
              <a
                href={`mailto:${person.email}`}
                className="text-primary transition-colors hover:text-primary-hover"
              >
                {person.email}
              </a>
              <CopyButton value={person.email} label="Kopírovat e-mail" />
            </span>
          ) : null}
          {person.phone !== undefined ? (
            <span className="inline-flex items-center gap-1">
              <a
                href={`tel:${person.phone.replace(/\s/g, "")}`}
                className="tabular-nums text-muted transition-colors hover:text-foreground"
              >
                {person.phone}
              </a>
              <CopyButton value={person.phone} label="Kopírovat telefon" />
            </span>
          ) : null}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-0.5">
        <button
          type="button"
          disabled={person.isPrimary}
          onClick={onSetPrimary}
          aria-label={person.isPrimary ? "Primární kontakt" : "Nastavit jako primární"}
          title={person.isPrimary ? "Primární kontakt" : "Nastavit jako primární"}
          className={cn(
            "flex size-8 items-center justify-center rounded-full transition-colors",
            person.isPrimary
              ? "text-primary"
              : "text-muted-soft hover:bg-surface-3/60 hover:text-foreground disabled:opacity-50",
          )}
        >
          <Star className={cn("size-4", person.isPrimary && "fill-current")} />
        </button>
        <button
          type="button"
          aria-label="Raport"
          title="Raport"
          onClick={() => setRapportOpen(true)}
          className="flex size-8 cursor-pointer items-center justify-center rounded-full text-muted-soft transition-colors hover:bg-surface-3/60 hover:text-foreground"
        >
          <HeartHandshake className="size-4" />
        </button>
        <PersonRapportDialog
          orgSlug={orgSlug}
          person={person}
          kindOptions={personKindOptions}
          entryKindOptions={rapportEntryKindOptions}
          clientOptions={[{ id: clientId, name: clientName }]}
          open={rapportOpen}
          onOpenChange={setRapportOpen}
          onChanged={() => router.refresh()}
        />
        <EditPersonDialog person={person} clientId={clientId} />
        <ConfirmDialog
          trigger={
            <button
              type="button"
              aria-label="Smazat kontakt"
              title="Smazat kontakt"
              className="flex size-8 items-center justify-center rounded-full text-muted-soft transition-colors hover:bg-danger-soft hover:text-danger disabled:opacity-50"
            >
              <Trash2 className="size-4" />
            </button>
          }
          title="Smazat kontakt"
          description={`Kontakt ${person.name} bude odebrán. Akci nelze vrátit.`}
          confirmLabel="Smazat"
          destructive
          onConfirm={async () => {
            const result = await deletePersonAction(orgSlug, person.id, clientId)
            if (result.status === "success") {
              toastWithUndo(result, () => router.refresh())
              router.refresh()
            } else if (result.status === "error") {
              toast({ variant: "error", title: result.message })
            }
          }}
        />
      </div>
    </div>
  )
}

interface PersonFieldsProps {
  idPrefix: string
  initial?: Pick<Person, "name" | "role" | "email" | "phone">
}

function PersonFields({ idPrefix, initial }: PersonFieldsProps) {
  const id = (name: string) => `${idPrefix}-${name}`
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <Field label="Jméno" htmlFor={id("name")} required>
          <Input
            id={id("name")}
            name="name"
            defaultValue={initial?.name}
            placeholder="Jan Vranský"
            required
            autoComplete="off"
          />
        </Field>
      </div>
      <Field label="Role" htmlFor={id("role")}>
        <Input
          id={id("role")}
          name="role"
          defaultValue={initial?.role}
          placeholder="Jednatel"
          autoComplete="off"
        />
      </Field>
      <Field label="Telefon" htmlFor={id("phone")}>
        <Input
          id={id("phone")}
          name="phone"
          defaultValue={initial?.phone}
          placeholder="+420 123 456 789"
          autoComplete="off"
        />
      </Field>
      <div className="sm:col-span-2">
        <Field label="E-mail" htmlFor={id("email")}>
          <Input
            id={id("email")}
            name="email"
            type="email"
            defaultValue={initial?.email}
            placeholder="jan@nabytek-vransky.cz"
            autoComplete="off"
          />
        </Field>
      </div>
    </div>
  )
}

function AddPersonDialog({ clientId }: { clientId: string }) {
  const { orgSlug } = useOrg()
  const [open, setOpen] = useState(false)
  const [state, formAction, pending] = useActionState(
    createPersonAction.bind(null, orgSlug),
    idleState,
  )
  const { toast } = useToast()

  useEffect(() => {
    if (state.status === "success") {
      toast({ variant: "success", title: state.message })
      setOpen(false)
    } else if (state.status === "error") {
      toast({ variant: "error", title: state.message })
    }
  }, [state, toast])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <Plus className="size-4" />
          Přidat kontakt
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Přidat kontakt</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="clientId" value={clientId} />
          <PersonFields idPrefix={`add-person-${clientId}`} />
          <label className="flex cursor-pointer items-center gap-2.5 text-[13px] text-foreground">
            <input
              type="checkbox"
              name="isPrimary"
              className="size-4 rounded border-border-strong text-primary focus:ring-primary/20"
            />
            Nastavit jako primární kontakt
          </label>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost" size="sm">
                Zrušit
              </Button>
            </DialogClose>
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? <Spinner className="size-4" /> : <Plus className="size-4" />}
              Přidat kontakt
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function EditPersonDialog({ person, clientId }: { person: Person; clientId: string }) {
  const { orgSlug } = useOrg()
  const [open, setOpen] = useState(false)
  const [state, formAction, pending] = useActionState(
    updatePersonAction.bind(null, orgSlug),
    idleState,
  )
  const { toast } = useToast()

  useEffect(() => {
    if (state.status === "success") {
      toast({ variant: "success", title: state.message })
      setOpen(false)
    } else if (state.status === "error") {
      toast({ variant: "error", title: state.message })
    }
  }, [state, toast])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label="Upravit kontakt"
          title="Upravit kontakt"
          className="flex size-8 items-center justify-center rounded-full text-muted-soft transition-colors hover:bg-surface-3/60 hover:text-foreground"
        >
          <Pencil className="size-4" />
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upravit kontakt</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="personId" value={person.id} />
          <input type="hidden" name="clientId" value={clientId} />
          <PersonFields
            idPrefix={`edit-person-${person.id}`}
            initial={{
              name: person.name,
              role: person.role,
              email: person.email,
              phone: person.phone,
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
      </DialogContent>
    </Dialog>
  )
}
