"use client"

import { UserPlus } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, type FormEvent } from "react"
import { Button } from "@/app/_ui/Button"
import { Field } from "@/app/_ui/Field"
import { Input } from "@/app/_ui/Input"
import { Spinner } from "@/app/_ui/Spinner"
import { authClient } from "@/lib/auth/auth-client"
import { orgHref } from "@/lib/nav"

export function InviteSignUp({
  invitationId,
  email,
  orgSlug,
  orgName,
}: {
  invitationId: string
  email: string
  orgSlug: string
  orgName: string
}) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | undefined>(undefined)

  const onSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const name = String(formData.get("name") ?? "").trim()
    const password = String(formData.get("password") ?? "")

    setPending(true)
    setError(undefined)

    const signUp = await authClient.signUp.email({ email, password, name })
    if (signUp.error !== null) {
      setError("Účet se nepodařilo vytvořit. Zkontroluj heslo (min. 8 znaků).")
      setPending(false)

      return
    }

    const accept = await authClient.organization.acceptInvitation({ invitationId })
    if (accept.error !== null) {
      setError("Účet je vytvořen, ale pozvánku se nepodařilo přijmout. Otevři odkaz znovu.")
      setPending(false)

      return
    }

    router.push(orgHref(orgSlug, "/prehled"))
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <h2 className="text-[20px] font-semibold tracking-tight text-foreground">
          Vytvoř si účet
        </h2>
        <p className="text-[13px] leading-relaxed text-muted">
          Pozvánka do workspace <span className="font-medium text-foreground">{orgName}</span>.
          Dokonči registraci a připoj se.
        </p>
      </div>
      <form onSubmit={onSubmit} className="flex flex-col gap-5">
        <Field label="E-mail" htmlFor="invite-signup-email">
          <Input id="invite-signup-email" type="email" value={email} disabled readOnly />
        </Field>
        <Field label="Jméno" htmlFor="invite-signup-name">
          <Input id="invite-signup-name" name="name" autoComplete="name" autoFocus required />
        </Field>
        <Field label="Heslo" htmlFor="invite-signup-password" error={error}>
          <Input
            id="invite-signup-password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            aria-invalid={error !== undefined}
          />
        </Field>
        <Button type="submit" size="md" disabled={pending} className="w-full cursor-pointer">
          {pending ? <Spinner className="size-4" /> : <UserPlus className="size-4" />}
          Vytvořit účet a připojit se
        </Button>
      </form>
      <p className="text-center text-[13px] text-muted">
        Už máš účet?{" "}
        <Link
          href={`/login?next=${encodeURIComponent(`/invite/${invitationId}`)}`}
          className="font-medium text-primary hover:underline"
        >
          Přihlas se
        </Link>
      </p>
    </div>
  )
}
