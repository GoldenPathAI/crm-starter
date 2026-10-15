"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Pencil, Trash2 } from "lucide-react"
import { Button } from "@/app/_ui/Button"
import { ConfirmDialog } from "@/app/_ui/ConfirmDialog"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/app/_ui/Dialog"
import { Spinner } from "@/app/_ui/Spinner"
import { ToastVariant, useToast } from "@/app/_ui/Toast"
import { useUndoToast } from "@/app/_lib/useUndoToast"
import type { EnumOption, Project } from "@/core/types/crm.types"
import {
  ProjectFormFields,
  emptyProjectValues,
  parseBudget,
  type ProjectFormValues,
} from "@/app/(app)/[orgSlug]/projekty/_components/ProjectFormFields"
import type { FormSelectOption } from "@/app/(app)/[orgSlug]/projekty/_components/types"
import { useOrg } from "@/app/_components/org/OrgProvider"
import { orgHref } from "@/lib/nav"
import { deleteProjectAction, updateProjectAction } from "../actions"

interface ProjectActionsProps {
  project: Project
  clientOptions: FormSelectOption[]
  statusOptions: EnumOption[]
  ticketCount: number
}

const valuesFromProject = (project: Project): ProjectFormValues =>
  emptyProjectValues(project.status, {
    clientId: project.clientId,
    name: project.name,
    description: project.description ?? "",
    status: project.status,
    startedAt: project.startedAt ?? "",
    dueAt: project.dueAt ?? "",
    budget: project.budgetCzk !== undefined ? String(project.budgetCzk) : "",
  })

export function ProjectActions({ project, clientOptions, statusOptions, ticketCount }: ProjectActionsProps) {
  const { orgSlug } = useOrg()
  const statusSelectOptions: FormSelectOption[] = statusOptions.map((option) => ({
    value: option.value,
    label: option.label,
  }))
  const router = useRouter()
  const { toast } = useToast()
  const { toastWithUndo } = useUndoToast()
  const [open, setOpen] = useState(false)
  const [isSaving, startSave] = useTransition()
  const [isDeleting, startDelete] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [values, setValues] = useState<ProjectFormValues>(() => valuesFromProject(project))

  // The form starts from the source project every time the dialog opens.
  const changeOpen = (next: boolean) => {
    if (next) {
      setValues(valuesFromProject(project))
      setError(null)
    }

    setOpen(next)
  }

  const save = () => {
    if (values.clientId.length === 0) {
      setError("Vyberte klienta.")

      return
    }

    if (values.name.trim().length === 0) {
      setError("Vyplňte název projektu.")

      return
    }

    setError(null)
    startSave(async () => {
      const result = await updateProjectAction(orgSlug, {
        projectId: project.id,
        clientId: values.clientId,
        name: values.name,
        description: values.description,
        status: values.status,
        startedAt: values.startedAt,
        dueAt: values.dueAt,
        budgetCzk: parseBudget(values.budget),
      })
      if (result.status === "success") {
        toast({ variant: ToastVariant.Success, title: result.message })
        setOpen(false)
        router.refresh()
      } else if (result.status === "error") {
        setError(result.message)
        toast({ variant: ToastVariant.Error, title: result.message })
      }
    })
  }

  const remove = () => {
    startDelete(async () => {
      const result = await deleteProjectAction(orgSlug, { projectId: project.id })
      if (result.status === "success") {
        toastWithUndo(result, () => router.refresh())
        router.push(orgHref(orgSlug, "/projekty"))
      } else if (result.status === "error") {
        toast({ variant: ToastVariant.Error, title: result.message })
      }
    })
  }

  const ticketWarning =
    ticketCount > 0
      ? `Smazáním projektu se nevratně odstraní i ${ticketCount} ${ticketNoun(ticketCount)}.`
      : "Projekt nemá žádné úkoly. Smazání je nevratné."

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Pencil className="size-4" />
          Upravit
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Upravit projekt</DialogTitle>
        </DialogHeader>
        <ProjectFormFields
          values={values}
          onChange={(patch) => setValues((prev) => ({ ...prev, ...patch }))}
          clientOptions={clientOptions}
          statusOptions={statusSelectOptions}
          idPrefix="edit-project"
          disabled={isSaving || isDeleting}
        />
        {error !== null ? <p className="text-[13px] font-medium text-danger">{error}</p> : null}
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="ghost" size="sm" disabled={isSaving || isDeleting}>
              Zrušit
            </Button>
          </DialogClose>
          <Button type="button" size="sm" onClick={save} disabled={isSaving || isDeleting}>
            {isSaving ? <Spinner className="size-4" /> : null}
            Uložit změny
          </Button>
        </DialogFooter>

        <div className="mt-1 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-danger/20 bg-danger-soft/40 px-4 py-3">
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-foreground">Smazat projekt</p>
            <p className="text-xs text-muted">{ticketWarning}</p>
          </div>
          <ConfirmDialog
            trigger={
              <Button type="button" variant="danger" size="sm" disabled={isSaving || isDeleting}>
                <Trash2 className="size-4" />
                Smazat
              </Button>
            }
            title="Smazat projekt"
            description={`${ticketWarning} Akci nelze vzít zpět.`}
            confirmLabel="Smazat projekt"
            onConfirm={remove}
            destructive
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}

const ticketNoun = (count: number): string => {
  if (count === 1) {
    return "úkol"
  }

  if (count >= 2 && count <= 4) {
    return "úkoly"
  }

  return "úkolů"
}
