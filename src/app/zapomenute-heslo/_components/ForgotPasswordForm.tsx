"use client"

import { Mail } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import type { FormEvent } from "react"
import { Button } from "@/app/_ui/Button"
import { Field } from "@/app/_ui/Field"
import { Input } from "@/app/_ui/Input"
import { Spinner } from "@/app/_ui/Spinner"
import { authClient } from "@/lib/auth/auth-client"
import { config } from "@/lib/config"

const NEUTRAL_MESSAGE = "Pokud účet existuje, poslali jsme odkaz na obnovení hesla"

export function ForgotPasswordForm() {
  const [pending, setPending] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const onSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const email = String(formData.get("email") ?? "").trim()

    setPending(true)
    await authClient.requestPasswordReset({
      email,
      redirectTo: `${config.authBaseUrl}/reset-hesla`,
    })
    setPending(false)
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <div className="flex flex-col gap-5">
        <p className="text-[13px] leading-relaxed text-muted">{NEUTRAL_MESSAGE}</p>
        <Link
          href="/login"
          className="text-center text-[13px] font-medium text-primary hover:underline"
        >
          Zpět na přihlášení
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <Field label="E-mail" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="email" autoFocus required />
      </Field>

      <Button type="submit" size="md" disabled={pending} className="w-full">
        {pending ? <Spinner className="size-4" /> : <Mail className="size-4" />}
        Poslat odkaz
      </Button>

      <Link
        href="/login"
        className="text-center text-[13px] font-medium text-primary hover:underline"
      >
        Zpět na přihlášení
      </Link>
    </form>
  )
}
