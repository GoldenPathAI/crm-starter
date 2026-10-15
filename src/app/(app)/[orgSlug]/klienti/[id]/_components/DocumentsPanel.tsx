"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Download, ExternalLink, FileText, Pencil, Plus, Trash2 } from "lucide-react"
import { Button } from "@/app/_ui/Button"
import { ConfirmDialog } from "@/app/_ui/ConfirmDialog"
import { EmptyState } from "@/app/_ui/EmptyState"
import { Table, TBody, TD, TH, THead, TR } from "@/app/_ui/Table"
import { ToastVariant, useToast } from "@/app/_ui/Toast"
import { useUndoToast } from "@/app/_lib/useUndoToast"
import { useOrg } from "@/app/_components/org/OrgProvider"
import type { Doc } from "@/core/types/crm.types"
import { SoftBadge } from "@/app/(app)/[orgSlug]/klienti/_components/SoftBadge"
import { badgeFor, type EnumView } from "@/app/(app)/[orgSlug]/klienti/_lib/enums"
import { formatCzkOrDash } from "@/app/(app)/[orgSlug]/klienti/_lib/format"
import { emptyDocumentValues, type DocumentFormValues } from "../_lib/documentForm"
import {
  createDocumentAction,
  deleteDocumentAction,
  presignDocumentDownloadAction,
  updateDocumentAction,
} from "../documentActions"
import { DocumentFormDialog } from "./DocumentFormDialog"

interface DocumentsPanelProps {
  clientId: string
  documents: Doc[]
  docKindView: EnumView
}

const toFormValues = (doc: Doc): DocumentFormValues => ({
  kind: doc.kind,
  title: doc.title,
  amountCzk: doc.amountCzk !== undefined ? String(doc.amountCzk) : "",
  url: doc.url ?? "",
  file:
    doc.fileKey !== undefined
      ? { key: doc.fileKey, name: doc.fileName ?? "soubor", size: doc.fileSize ?? 0 }
      : undefined,
})

export function DocumentsPanel({ clientId, documents, docKindView }: DocumentsPanelProps) {
  const { orgSlug } = useOrg()
  const router = useRouter()
  const { toast } = useToast()
  const { toastWithUndo } = useUndoToast()
  const [addOpen, setAddOpen] = useState(false)
  const [editing, setEditing] = useState<Doc | null>(null)

  const addInitialValues: DocumentFormValues = {
    ...emptyDocumentValues(),
    kind: docKindView.options[0]?.value ?? "poznamka",
  }

  const handleCreate = async (values: DocumentFormValues) => {
    const result = await createDocumentAction(orgSlug, clientId, values)
    if (result.status === "success") {
      router.refresh()
    }

    return result
  }

  const handleUpdate = async (values: DocumentFormValues) => {
    if (editing === null) {
      return { status: "error" as const, message: "Chybí dokument." }
    }

    const result = await updateDocumentAction(orgSlug, editing.id, clientId, values)
    if (result.status === "success") {
      router.refresh()
    }

    return result
  }

  const handleDownload = async (doc: Doc) => {
    const result = await presignDocumentDownloadAction(orgSlug, doc.id)
    if (result.status === "success") {
      window.open(result.url, "_blank", "noopener,noreferrer")
    } else if (result.status === "error") {
      toast({ variant: ToastVariant.Error, title: result.message })
    }
  }

  const handleDelete = async (doc: Doc) => {
    const result = await deleteDocumentAction(orgSlug, doc.id, clientId)
    if (result.status === "success") {
      toastWithUndo(result, () => router.refresh())
      router.refresh()
    } else if (result.status === "error") {
      toast({ variant: ToastVariant.Error, title: result.message })
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-end gap-3">
        <Button size="sm" onClick={() => setAddOpen(true)}>
          <Plus className="size-4" />
          Přidat dokument
        </Button>
      </div>

      {documents.length === 0 ? (
        <div className="overflow-hidden rounded-2xl border border-hairline bg-surface shadow-soft">
          <EmptyState
            icon={<FileText className="size-6" />}
            title="Žádné dokumenty"
            description="Přidejte smlouvu, nabídku nebo zápis a mějte je u klienta po ruce."
          />
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-hairline bg-surface shadow-soft">
          <div className="overflow-x-auto">
            <Table>
              <THead>
                <TR className="hover:bg-transparent">
                  <TH className="px-4 py-3 pl-5">Druh</TH>
                  <TH className="px-4 py-3">Název</TH>
                  <TH className="px-4 py-3">Částka</TH>
                  <TH className="px-4 py-3 pr-5" />
                </TR>
              </THead>
              <TBody>
                {documents.map((doc) => {
                  return (
                    <TR key={doc.id}>
                      <TD className="pl-5">
                        <SoftBadge style={badgeFor(docKindView, doc.kind)} />
                      </TD>
                      <TD className="text-[13px] font-medium text-foreground">{doc.title}</TD>
                      <TD className="tabular-nums text-[13px] text-muted">
                        {formatCzkOrDash(doc.amountCzk)}
                      </TD>
                      <TD className="pr-5">
                        <div className="flex items-center justify-end gap-0.5">
                          {doc.fileKey !== undefined ? (
                            <button
                              type="button"
                              onClick={() => void handleDownload(doc)}
                              aria-label={`Stáhnout ${doc.title}`}
                              title="Stáhnout soubor"
                              className="inline-flex size-8 cursor-pointer items-center justify-center rounded-full text-muted-soft transition-colors hover:bg-surface-2 hover:text-foreground"
                            >
                              <Download className="size-4" />
                            </button>
                          ) : null}
                          {doc.url !== undefined ? (
                            <a
                              href={doc.url}
                              target="_blank"
                              rel="noreferrer"
                              aria-label={`Otevřít ${doc.title}`}
                              title="Otevřít odkaz"
                              className="inline-flex items-center gap-1.5 rounded-full text-muted-soft transition-colors hover:text-foreground"
                            >
                              <span className="inline-flex size-8 items-center justify-center rounded-full transition-colors hover:bg-surface-2">
                                <ExternalLink className="size-4" />
                              </span>
                            </a>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => setEditing(doc)}
                            aria-label={`Upravit ${doc.title}`}
                            title="Upravit"
                            className="inline-flex size-8 items-center justify-center rounded-full text-muted-soft transition-colors hover:bg-surface-2 hover:text-foreground"
                          >
                            <Pencil className="size-4" />
                          </button>
                          <ConfirmDialog
                            trigger={
                              <button
                                type="button"
                                aria-label={`Smazat ${doc.title}`}
                                title="Smazat"
                                className="inline-flex size-8 items-center justify-center rounded-full text-muted-soft transition-colors hover:bg-danger-soft hover:text-danger"
                              >
                                <Trash2 className="size-4" />
                              </button>
                            }
                            title="Smazat dokument"
                            description={`Dokument ${doc.title} bude odebrán. Akci nelze vrátit.`}
                            confirmLabel="Smazat"
                            destructive
                            onConfirm={() => handleDelete(doc)}
                          />
                        </div>
                      </TD>
                    </TR>
                  )
                })}
              </TBody>
            </Table>
          </div>
        </div>
      )}

      <DocumentFormDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        title="Přidat dokument"
        submitLabel="Přidat"
        onSubmit={handleCreate}
        initialValues={addInitialValues}
        docKindView={docKindView}
      />
      <DocumentFormDialog
        open={editing !== null}
        onOpenChange={(next) => {
          if (!next) {
            setEditing(null)
          }
        }}
        title="Upravit dokument"
        submitLabel="Uložit změny"
        onSubmit={handleUpdate}
        initialValues={editing !== null ? toFormValues(editing) : undefined}
        docKindView={docKindView}
      />
    </div>
  )
}
