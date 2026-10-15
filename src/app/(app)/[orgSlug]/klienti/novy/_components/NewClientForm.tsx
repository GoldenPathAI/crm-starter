"use client"

import { useActionState, useEffect, useState, type FormEvent } from "react"
import Link from "next/link"
import { UserPlus } from "lucide-react"
import { Button } from "@/app/_ui/Button"
import { Card, CardContent, CardHeader, CardTitle } from "@/app/_ui/Card"
import { Field } from "@/app/_ui/Field"
import { Input } from "@/app/_ui/Input"
import { Spinner } from "@/app/_ui/Spinner"
import { useToast } from "@/app/_ui/Toast"
import { idleState } from "@/app/_lib/actionState"
import { orgHref } from "@/lib/nav"
import { useOrg } from "@/app/_components/org/OrgProvider"
import { ClientFormFields, type ClientFieldErrors } from "../../_components/ClientFormFields"
import { type EnumView } from "../../_lib/enums"
import { createClientAction } from "../actions"

interface NewClientFormProps {
  statusView: EnumView
  serviceView: EnumView
}

export function NewClientForm({ statusView, serviceView }: NewClientFormProps) {
  const { toast } = useToast()
  const { orgSlug } = useOrg()
  const [state, formAction, pending] = useActionState(
    createClientAction.bind(null, orgSlug),
    idleState,
  )
  const [errors, setErrors] = useState<ClientFieldErrors>({})

  useEffect(() => {
    if (state.status === "error") {
      toast({ variant: "error", title: state.message })
    }
  }, [state, toast])

  const clearError = (field: keyof ClientFieldErrors) => {
    setErrors((prev) => (prev[field] === undefined ? prev : { ...prev, [field]: undefined }))
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    const formData = new FormData(event.currentTarget)
    const name = formData.get("name")
    const industry = formData.get("industry")
    const nextErrors: ClientFieldErrors = {}
    if (typeof name !== "string" || name.trim().length === 0) {
      nextErrors.name = "Vyplňte název klienta."
    }

    if (typeof industry !== "string" || industry.trim().length === 0) {
      nextErrors.industry = "Vyplňte obor."
    }

    if (nextErrors.name !== undefined || nextErrors.industry !== undefined) {
      event.preventDefault()
      setErrors(nextErrors)
      const firstInvalid =
        nextErrors.name !== undefined ? "new-client-name" : "new-client-industry"
      document.getElementById(firstInvalid)?.focus()

      return
    }

    setErrors({})
  }

  return (
    <form action={formAction} onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
      <Card>
        <CardHeader>
          <CardTitle>Firma</CardTitle>
        </CardHeader>
        <CardContent>
          <ClientFormFields
            idPrefix="new-client"
            statusView={statusView}
            serviceView={serviceView}
            essential
            errors={errors}
            onErrorClear={clearError}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Primární kontakt</CardTitle>
          <span className="text-[13px] text-muted-soft">Nepovinné</span>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Jméno" htmlFor="contact-name">
              <Input
                id="contact-name"
                name="contactName"
                placeholder="Jan Vranský"
                autoComplete="off"
              />
            </Field>
            <Field label="Role" htmlFor="contact-role">
              <Input
                id="contact-role"
                name="contactRole"
                placeholder="Jednatel"
                autoComplete="off"
              />
            </Field>
            <Field label="E-mail" htmlFor="contact-email">
              <Input
                id="contact-email"
                name="contactEmail"
                type="email"
                placeholder="jan@nabytek-vransky.cz"
                autoComplete="off"
              />
            </Field>
            <Field label="Telefon" htmlFor="contact-phone">
              <Input
                id="contact-phone"
                name="contactPhone"
                placeholder="+420 123 456 789"
                autoComplete="off"
              />
            </Field>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-2">
        <Button asChild variant="ghost" size="md">
          <Link href={orgHref(orgSlug, "/klienti")}>Zrušit</Link>
        </Button>
        <Button type="submit" size="md" disabled={pending}>
          {pending ? <Spinner className="size-4" /> : <UserPlus className="size-4" />}
          Vytvořit klienta
        </Button>
      </div>
    </form>
  )
}
