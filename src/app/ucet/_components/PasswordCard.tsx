"use client"

import { KeyRound } from "lucide-react"
import { useState } from "react"
import type { FormEvent } from "react"
import { Button } from "@/app/_ui/Button"
import { Card, CardContent, CardHeader, CardTitle } from "@/app/_ui/Card"
import { Field } from "@/app/_ui/Field"
import { Input } from "@/app/_ui/Input"
import { Spinner } from "@/app/_ui/Spinner"
import { useToast } from "@/app/_ui/Toast"
import { authClient } from "@/lib/auth/auth-client"

const MIN_PASSWORD_LENGTH = 8

export function PasswordCard() {
  const { toast } = useToast()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | undefined>(undefined)

  const onSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    const form = event.currentTarget
    const formData = new FormData(form)
    const currentPassword = String(formData.get("currentPassword") ?? "")
    const newPassword = String(formData.get("newPassword") ?? "")
    const confirmPassword = String(formData.get("confirmPassword") ?? "")

    setError(undefined)

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setError("Heslo musí mít alespoň 8 znaků")
      return
    }
    if (newPassword !== confirmPassword) {
      setError("Nová hesla se neshodují")
      return
    }

    setPending(true)
    const result = await authClient.changePassword({
      currentPassword,
      newPassword,
      revokeOtherSessions: true,
    })
    setPending(false)

    if (result.error !== null) {
      if (result.error.code === "INVALID_PASSWORD") {
        setError("Současné heslo nesouhlasí")
      } else if (result.error.code === "PASSWORD_TOO_SHORT") {
        setError("Heslo musí mít alespoň 8 znaků")
      } else {
        setError("Heslo se nepodařilo změnit")
      }
      return
    }

    form.reset()
    toast({
      variant: "success",
      title: "Heslo změněno",
      description: "Ostatní zařízení byla odhlášena",
    })
  }

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Heslo</CardTitle>
          <p className="mt-1 text-sm text-muted">Změna přihlašovacího hesla</p>
        </div>
      </CardHeader>
      <CardContent className="px-6 py-6">
        <form onSubmit={onSubmit} className="flex flex-col gap-5">
          <Field label="Současné heslo" htmlFor="currentPassword">
            <Input
              id="currentPassword"
              name="currentPassword"
              type="password"
              autoComplete="current-password"
              required
            />
          </Field>
          <Field label="Nové heslo" htmlFor="newPassword" hint="Alespoň 8 znaků">
            <Input
              id="newPassword"
              name="newPassword"
              type="password"
              autoComplete="new-password"
              minLength={MIN_PASSWORD_LENGTH}
              required
            />
          </Field>
          <Field label="Nové heslo znovu" htmlFor="confirmPassword" error={error}>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              aria-invalid={error !== undefined}
              required
            />
          </Field>
          <div className="flex justify-end">
            <Button type="submit" disabled={pending}>
              {pending ? <Spinner className="size-4" /> : <KeyRound className="size-4" />}
              Změnit heslo
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
