"use client"

import { useEffect, useState } from "react"
import type { FormEvent } from "react"
import { useRouter } from "next/navigation"
import { Building2 } from "lucide-react"
import { Button } from "@/app/_ui/Button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/app/_ui/Dialog"
import { Field } from "@/app/_ui/Field"
import { Input } from "@/app/_ui/Input"
import { Spinner } from "@/app/_ui/Spinner"
import { authClient } from "@/lib/auth/auth-client"

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

function slugifyName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

export function CreateWorkspaceDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const router = useRouter()
  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")
  const [slugTouched, setSlugTouched] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | undefined>(undefined)

  useEffect(() => {
    if (!open) {
      setName("")
      setSlug("")
      setSlugTouched(false)
      setPending(false)
      setError(undefined)
    }
  }, [open])

  const effectiveSlug = slugTouched ? slug : slugifyName(name)

  const onSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    const trimmedName = name.trim()
    if (trimmedName.length === 0) {
      setError("Zadej název workspace.")
      return
    }
    if (!SLUG_PATTERN.test(effectiveSlug)) {
      setError("Identifikátor smí obsahovat jen malá písmena, číslice a pomlčky.")
      return
    }
    setPending(true)
    setError(undefined)
    const result = await authClient.organization.create({ name: trimmedName, slug: effectiveSlug })
    if (result.error !== null && result.error !== undefined) {
      const message = result.error.message ?? ""
      setError(
        /slug|exist|taken|already/i.test(message)
          ? "Tento identifikátor už je obsazený."
          : "Workspace se nepodařilo vytvořit.",
      )
      setPending(false)
      return
    }
    onOpenChange(false)
    router.push(`/${effectiveSlug}/prehled`)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary-soft text-primary">
            <Building2 className="size-5" />
          </span>
          <DialogTitle>Nová workspace</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="flex flex-col gap-5">
          <Field label="Název" htmlFor="workspace-name" required>
            <Input
              id="workspace-name"
              autoFocus
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Acme s.r.o."
              required
            />
          </Field>
          <Field
            label="Identifikátor"
            htmlFor="workspace-slug"
            error={error}
            hint="Použije se v URL, jen malá písmena, číslice a pomlčky"
          >
            <Input
              id="workspace-slug"
              value={effectiveSlug}
              onChange={(event) => {
                setSlugTouched(true)
                setSlug(event.target.value)
              }}
              placeholder="acme"
              className="font-mono"
              aria-invalid={error !== undefined}
            />
          </Field>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Zrušit
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? <Spinner className="size-4" /> : null}
              Vytvořit
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
