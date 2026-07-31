"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { FolderPlus } from "lucide-react"
import { Button } from "@/app/_ui/Button"
import { Spinner } from "@/app/_ui/Spinner"
import { useToast } from "@/app/_ui/Toast"
import {
  ProjectFormFields,
  emptyProjectValues,
  parseBudget,
  type ProjectFormValues,
} from "../../_components/ProjectFormFields"
import type { FormSelectOption } from "../../_components/types"
import { useOrg } from "@/app/_components/org/OrgProvider"
import { orgHref } from "@/lib/nav"
import type { EnumOption } from "@/core/types/crm.types"
import { createProjectAction } from "../actions"

interface NewProjectFormProps {
  clientOptions: FormSelectOption[]
  statusOptions: EnumOption[]
  prefill: Partial<ProjectFormValues>
  dealId: string
}

export function NewProjectForm({ clientOptions, statusOptions, prefill, dealId }: NewProjectFormProps) {
  const { orgSlug } = useOrg()
  const { toast } = useToast()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const statusSelectOptions: FormSelectOption[] = statusOptions.map((option) => ({
    value: option.value,
    label: option.label,
  }))
  const defaultStatus =
    statusOptions.find((option) => option.semantic === "prep")?.value ??
    statusOptions[0]?.value ??
    ""
  const [values, setValues] = useState<ProjectFormValues>(() =>
    emptyProjectValues(defaultStatus, prefill),
  )

  const submit = () => {
    if (values.clientId.length === 0) {
      setError("Vyberte klienta.")
      return
    }
    if (values.name.trim().length === 0) {
      setError("Vyplňte název projektu.")
      return
    }
    setError(null)
    startTransition(async () => {
      const result = await createProjectAction(orgSlug, {
        clientId: values.clientId,
        name: values.name,
        description: values.description,
        status: values.status,
        startedAt: values.startedAt,
        dueAt: values.dueAt,
        budgetCzk: parseBudget(values.budget),
        dealId,
      })
      if (result.status === "error") {
        setError(result.message)
        toast({ variant: "error", title: result.message })
      }
    })
  }

  return (
    <div className="max-w-2xl rounded-2xl border border-hairline bg-surface p-6 shadow-soft sm:p-7">
      <ProjectFormFields
        values={values}
        onChange={(patch) => setValues((prev) => ({ ...prev, ...patch }))}
        clientOptions={clientOptions}
        statusOptions={statusSelectOptions}
        idPrefix="new-project"
        disabled={isPending}
      />
      {error !== null ? (
        <p className="mt-4 text-[13px] font-medium text-danger">{error}</p>
      ) : null}
      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button asChild variant="ghost" size="sm">
          <Link href={orgHref(orgSlug, "/projekty")}>Zrušit</Link>
        </Button>
        <Button type="button" size="sm" onClick={submit} disabled={isPending}>
          {isPending ? <Spinner className="size-4" /> : <FolderPlus className="size-4" />}
          Vytvořit projekt
        </Button>
      </div>
    </div>
  )
}
