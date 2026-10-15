"use client"

import { useRef, useState, useTransition } from "react"
import { Check, Paperclip, Upload, X } from "lucide-react"
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
import { useOrg } from "@/app/_components/org/OrgProvider"
import { config } from "@/lib/config"
import type { ActionState } from "@/app/_lib/actionState"
import { presignDocumentUploadAction } from "../documentActions"
import { selectOptions, type EnumView } from "@/app/(app)/[orgSlug]/klienti/_lib/enums"
import { emptyDocumentValues, isDocKind, type DocumentFormValues } from "../_lib/documentForm"

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) {
    return `${bytes} B`
  }

  const kb = bytes / 1024
  if (kb < 1024) {
    return `${Math.round(kb)} kB`
  }

  return `${(kb / 1024).toFixed(1)} MB`
}

interface DocumentFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  submitLabel: string
  onSubmit: (values: DocumentFormValues) => Promise<ActionState>
  initialValues?: DocumentFormValues
  docKindView: EnumView
}

export function DocumentFormDialog({
  open,
  onOpenChange,
  title,
  submitLabel,
  onSubmit,
  initialValues,
  docKindView,
}: DocumentFormDialogProps) {
  const { toast } = useToast()
  const { orgSlug } = useOrg()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [values, setValues] = useState<DocumentFormValues>(
    () => initialValues ?? emptyDocumentValues(),
  )

  // Reset only when the dialog is (re)opened, adjusted during render. A new key remounts
  // the file input, which clears the file the browser still holds from last time.
  const [wasOpen, setWasOpen] = useState(open)
  const [fileInputKey, setFileInputKey] = useState(0)
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setValues(initialValues ?? emptyDocumentValues())
      setError(null)
      setFile(null)
      setFileInputKey((key) => key + 1)
    }
  }

  const patch = (next: Partial<DocumentFormValues>) => setValues((prev) => ({ ...prev, ...next }))

  const pickFile = (next: File | null) => {
    if (next !== null && next.size > config.files.maxUploadBytes) {
      setError("Soubor je větší než 25 MB.")

      return
    }

    setError(null)
    setFile(next)
  }

  // Uploads the picked file straight to S3 through a presigned PUT and returns the
  // stored key. Null on any failure (message already surfaced).
  const uploadPickedFile = async (): Promise<DocumentFormValues["file"] | null> => {
    if (file === null) {
      return values.file
    }

    const presigned = await presignDocumentUploadAction(orgSlug, file.name, file.type, file.size)
    if (presigned.status === "error") {
      setError(presigned.message)
      toast({ variant: ToastVariant.Error, title: presigned.message })

      return null
    }

    const response = await fetch(presigned.url, {
      method: "PUT",
      headers: { "Content-Type": file.type },
      body: file,
    })
    if (!response.ok) {
      const message = "Nahrání souboru selhalo."
      setError(message)
      toast({ variant: ToastVariant.Error, title: message })

      return null
    }

    return { key: presigned.key, name: file.name, size: file.size }
  }

  const submit = () => {
    const trimmedTitle = values.title.trim()
    if (trimmedTitle.length === 0) {
      setError("Vyplňte název dokumentu.")

      return
    }

    setError(null)
    startTransition(async () => {
      const uploaded = await uploadPickedFile()
      // A picked file that failed to upload aborts the submit (message shown above).
      if (file !== null && uploaded === null) {
        return
      }

      const result = await onSubmit({ ...values, title: trimmedTitle, file: uploaded ?? undefined })
      if (result.status === "success") {
        toast({ variant: ToastVariant.Success, title: result.message })
        onOpenChange(false)
      } else if (result.status === "error") {
        setError(result.message)
        toast({ variant: ToastVariant.Error, title: result.message })
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Druh" htmlFor="doc-kind">
              <Select
                id="doc-kind"
                value={values.kind}
                onValueChange={(value) => {
                  if (isDocKind(value)) {
                    patch({ kind: value })
                  }
                }}
                options={selectOptions(docKindView)}
                disabled={isPending}
              />
            </Field>
            <Field label="Částka (Kč)" htmlFor="doc-amount">
              <Input
                id="doc-amount"
                value={values.amountCzk}
                onChange={(event) => patch({ amountCzk: event.target.value })}
                placeholder="45000"
                inputMode="numeric"
                autoComplete="off"
                disabled={isPending}
              />
            </Field>
          </div>

          <Field label="Název" htmlFor="doc-title" required>
            <Input
              id="doc-title"
              value={values.title}
              onChange={(event) => patch({ title: event.target.value })}
              placeholder="Smlouva o spolupráci"
              autoComplete="off"
              disabled={isPending}
            />
          </Field>

          <Field label="Odkaz" htmlFor="doc-url" hint="Nabídka nebo cloudové úložiště">
            <Input
              id="doc-url"
              value={values.url}
              onChange={(event) => patch({ url: event.target.value })}
              placeholder="https://"
              autoComplete="off"
              disabled={isPending}
            />
          </Field>

          <Field label="Soubor" htmlFor="doc-file" hint="Nahrajte přílohu do 25 MB">
            <input
              key={fileInputKey}
              ref={fileInputRef}
              id="doc-file"
              type="file"
              className="hidden"
              onChange={(event) => pickFile(event.target.files?.[0] ?? null)}
              disabled={isPending}
            />
            {file !== null ? (
              <div className="flex items-center gap-2 rounded-xl border border-border-strong/60 bg-surface px-3 py-2 text-[13px]">
                <Paperclip className="size-4 shrink-0 text-muted-soft" />
                <span className="min-w-0 flex-1 truncate text-foreground">{file.name}</span>
                <span className="shrink-0 tabular-nums text-muted-soft">{formatBytes(file.size)}</span>
                <button
                  type="button"
                  onClick={() => pickFile(null)}
                  aria-label="Odebrat soubor"
                  className="inline-flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-soft transition-colors hover:bg-surface-2 hover:text-foreground"
                  disabled={isPending}
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ) : values.file !== undefined ? (
              <div className="flex items-center gap-2 rounded-xl border border-border-strong/60 bg-surface px-3 py-2 text-[13px]">
                <Paperclip className="size-4 shrink-0 text-muted-soft" />
                <span className="min-w-0 flex-1 truncate text-foreground">{values.file.name}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isPending}
                >
                  Nahradit
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={isPending}
              >
                <Upload className="size-4" />
                Nahrát soubor
              </Button>
            )}
          </Field>
        </div>

        {error !== null ? <p className="text-[13px] font-medium text-danger">{error}</p> : null}
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="ghost" size="sm" disabled={isPending}>
              Zrušit
            </Button>
          </DialogClose>
          <Button type="button" size="sm" onClick={submit} disabled={isPending}>
            {isPending ? <Spinner className="size-4" /> : <Check className="size-4" />}
            {submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
