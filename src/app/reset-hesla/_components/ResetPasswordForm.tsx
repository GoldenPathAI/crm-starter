"use client"

import { KeyRound } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import type { FormEvent } from "react"
import { Button } from "@/app/_ui/Button"
import { Field } from "@/app/_ui/Field"
import { Input } from "@/app/_ui/Input"
import { Spinner } from "@/app/_ui/Spinner"
import { authClient } from "@/lib/auth/authClient"

const MIN_PASSWORD_LENGTH = 8

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | undefined>(undefined)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!done) return
    const timer = setTimeout(() => router.push("/login"), 2000)

    return () => clearTimeout(timer)
  }, [done, router])

  const onSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const password = String(formData.get("password") ?? "")
    const confirm = String(formData.get("confirm") ?? "")

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError("Heslo musí mít alespoň 8 znaků")

      return
    }

    if (password !== confirm) {
      setError("Hesla se neshodují")

      return
    }

    setPending(true)
    setError(undefined)
    const result = await authClient.resetPassword({ newPassword: password, token })
    if (result.error !== null) {
      setError("Odkaz vypršel nebo není platný. Požádej o nový.")
      setPending(false)

      return
    }

    setDone(true)
  }

  if (done) {
    return (
      <div className="flex flex-col gap-5">
        <p className="text-[13px] leading-relaxed text-muted">
          Heslo bylo změněno. Přesměrováváme tě na přihlášení.
        </p>
        <Link
          href="/login"
          className="text-center text-[13px] font-medium text-primary hover:underline"
        >
          Přejít na přihlášení
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <Field label="Nové heslo" htmlFor="password">
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          autoFocus
          required
        />
      </Field>

      <Field label="Nové heslo znovu" htmlFor="confirm" error={error}>
        <Input
          id="confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          required
          aria-invalid={error !== undefined}
        />
      </Field>

      <Button type="submit" size="md" disabled={pending} className="w-full">
        {pending ? <Spinner className="size-4" /> : <KeyRound className="size-4" />}
        Nastavit heslo
      </Button>
    </form>
  )
}
