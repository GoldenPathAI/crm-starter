"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { UserPlus } from "lucide-react"
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
import { Select } from "@/app/_ui/Select"
import { Spinner } from "@/app/_ui/Spinner"
import { ToastVariant, useToast } from "@/app/_ui/Toast"
import { crmApi, HttpMethod } from "@/app/_lib/apiClient"
import type { EnumOption, Person } from "@/core/types/crm.types"
import type { RapportClientOption } from "@/app/_components/rapport/PersonRapportDialog"

export function NewPersonButton({
  orgSlug,
  kindOptions,
  clientOptions,
}: {
  orgSlug: string
  kindOptions: EnumOption[]
  clientOptions: RapportClientOption[]
}) {
  const router = useRouter()
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [role, setRole] = useState("")
  const [kind, setKind] = useState(
    kindOptions.find((option) => option.semantic === "prospect")?.value ??
      kindOptions[0]?.value ??
      "",
  )
  const [clientId, setClientId] = useState("")
  const [pending, startTransition] = useTransition()

  const submit = (): void => {
    const trimmed = name.trim()
    if (trimmed.length === 0) {
      return
    }

    startTransition(async () => {
      try {
        await crmApi<Person>(orgSlug, HttpMethod.POST, "/people", {
          body: {
            name: trimmed,
            kind,
            ...(role.trim().length > 0 ? { role: role.trim() } : {}),
            ...(clientId.length > 0 ? { clientId } : {}),
          },
        })
        setName("")
        setRole("")
        setClientId("")
        setOpen(false)
        router.refresh()
      } catch (error) {
        toast({
          variant: ToastVariant.Error,
          title: error instanceof Error ? error.message : "Osobu se nepodařilo přidat.",
        })
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size="sm" onClick={() => setOpen(true)}>
        <UserPlus className="size-4" />
        Nová osoba
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nová osoba</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <Field label="Jméno" htmlFor="raport-name" required>
            <Input
              id="raport-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Jiří Koktan"
              autoComplete="off"
            />
          </Field>
          <Field label="Role" htmlFor="raport-role">
            <Input
              id="raport-role"
              value={role}
              onChange={(event) => setRole(event.target.value)}
              placeholder="Např. jednatel Stavby s.r.o."
              autoComplete="off"
            />
          </Field>
          <Field label="Typ" htmlFor="raport-kind">
            <Select
              id="raport-kind"
              value={kind}
              onValueChange={setKind}
              options={kindOptions.map((option) => ({
                value: option.value,
                label: option.label,
              }))}
            />
          </Field>
          <Field label="Klient" htmlFor="raport-client">
            <Select
              id="raport-client"
              value={clientId}
              onValueChange={setClientId}
              placeholder="Bez klienta"
              options={clientOptions.map((option) => ({ value: option.id, label: option.name }))}
            />
          </Field>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="ghost" size="sm">
              Zrušit
            </Button>
          </DialogClose>
          <Button type="button" size="sm" onClick={submit} disabled={pending}>
            {pending ? <Spinner className="size-4" /> : <UserPlus className="size-4" />}
            Přidat
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
