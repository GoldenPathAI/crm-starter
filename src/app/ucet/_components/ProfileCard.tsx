"use client"

import { Check, Pencil, X } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { Button } from "@/app/_ui/Button"
import { Card, CardContent, CardHeader, CardTitle } from "@/app/_ui/Card"
import { Input } from "@/app/_ui/Input"
import { Label } from "@/app/_ui/Label"
import { Spinner } from "@/app/_ui/Spinner"
import { ToastVariant, useToast } from "@/app/_ui/Toast"
import { authClient } from "@/lib/auth/authClient"

export function ProfileCard({ name, email }: { name: string; email: string }) {
  const { toast } = useToast()
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(name)
  const [pending, startTransition] = useTransition()

  const cancel = () => {
    setDraft(name)
    setEditing(false)
  }

  const save = () => {
    const trimmed = draft.trim()
    if (trimmed.length === 0 || trimmed === name) {
      cancel()

      return
    }

    startTransition(async () => {
      const result = await authClient.updateUser({ name: trimmed })
      if (result.error !== null) {
        toast({ variant: ToastVariant.Error, title: "Jméno se nepodařilo uložit" })

        return
      }

      toast({ variant: ToastVariant.Success, title: "Jméno uloženo" })
      setEditing(false)
      router.refresh()
    })
  }

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Profil</CardTitle>
          <p className="mt-1 text-sm text-muted">Jméno a přihlašovací e-mail</p>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-6 px-6 py-6">
        <div className="flex flex-col gap-2">
          <Label htmlFor="account-name">Jméno</Label>
          {editing ? (
            <div className="flex items-center gap-2">
              <Input
                id="account-name"
                autoFocus
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault()
                    save()
                  } else if (event.key === "Escape") {
                    event.preventDefault()
                    cancel()
                  }
                }}
              />
              <Button
                type="button"
                size="icon"
                variant="secondary"
                onClick={save}
                disabled={pending}
                aria-label="Uložit"
              >
                {pending ? <Spinner className="size-4" /> : <Check className="size-4" />}
              </Button>
              <Button type="button" size="icon" variant="ghost" onClick={cancel} aria-label="Zrušit">
                <X className="size-4" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="flex h-11 flex-1 items-center rounded-xl border border-transparent px-4 text-[15px] text-foreground">
                {name}
              </span>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={() => setEditing(true)}
                aria-label="Upravit jméno"
              >
                <Pencil className="size-4" />
              </Button>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="account-email">E-mail</Label>
          <Input id="account-email" value={email} readOnly disabled />
          <p className="text-xs text-muted">E-mail nelze změnit</p>
        </div>
      </CardContent>
    </Card>
  )
}
