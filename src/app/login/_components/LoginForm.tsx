"use client"

import { LogIn } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import type { FormEvent } from "react"
import { Button } from "@/app/_ui/Button"
import { Field } from "@/app/_ui/Field"
import { Input } from "@/app/_ui/Input"
import { Spinner } from "@/app/_ui/Spinner"
import { authClient } from "@/lib/auth/auth-client"

export function LoginForm() {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | undefined>(undefined)

  const onSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const email = String(formData.get("email") ?? "")
    const password = String(formData.get("password") ?? "")

    setPending(true)
    setError(undefined)
    const result = await authClient.signIn.email({ email, password })
    if (result.error !== null) {
      setError("Neplatný e-mail nebo heslo")
      setPending(false)

      return
    }

    router.push("/")
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <Field label="E-mail" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="email" autoFocus required />
      </Field>

      <Field label="Heslo" htmlFor="password" error={error}>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={error !== undefined}
        />
      </Field>

      <div className="-mt-1 text-right">
        <Link
          href="/zapomenute-heslo"
          className="text-[13px] font-medium text-primary hover:underline"
        >
          Zapomenuté heslo?
        </Link>
      </div>

      <Button type="submit" size="md" disabled={pending} className="w-full">
        {pending ? <Spinner className="size-4" /> : <LogIn className="size-4" />}
        Přihlásit se
      </Button>
    </form>
  )
}
