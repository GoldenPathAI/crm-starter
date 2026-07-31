"use client"

import { Field } from "@/app/_ui/Field"
import { Input } from "@/app/_ui/Input"
import { Select } from "@/app/_ui/Select"
import { DatePicker } from "@/app/_ui/DatePicker"
import { Textarea } from "@/app/_ui/Textarea"
import type { FormSelectOption } from "./types"

export interface ProjectFormValues {
  clientId: string
  name: string
  description: string
  status: string
  startedAt: string
  dueAt: string
  budget: string
}

export const emptyProjectValues = (
  defaultStatus: string,
  overrides?: Partial<ProjectFormValues>,
): ProjectFormValues => ({
  clientId: "",
  name: "",
  description: "",
  status: defaultStatus,
  startedAt: "",
  dueAt: "",
  budget: "",
  ...overrides,
})

export const parseBudget = (raw: string): number | null => {
  const digits = raw.replace(/\D/g, "")
  if (digits.length === 0) {
    return null
  }
  const value = Number.parseInt(digits, 10)
  return Number.isFinite(value) ? value : null
}

interface ProjectFormFieldsProps {
  values: ProjectFormValues
  onChange: (patch: Partial<ProjectFormValues>) => void
  clientOptions: FormSelectOption[]
  statusOptions: FormSelectOption[]
  idPrefix: string
  disabled?: boolean
}

export function ProjectFormFields({
  values,
  onChange,
  clientOptions,
  statusOptions,
  idPrefix,
  disabled,
}: ProjectFormFieldsProps) {
  return (
    <div className="flex flex-col gap-4">
      <Field label="Klient" htmlFor={`${idPrefix}-client`} required>
        <Select
          id={`${idPrefix}-client`}
          value={values.clientId}
          onValueChange={(value) => onChange({ clientId: value })}
          options={clientOptions}
          placeholder="Vyberte klienta"
          disabled={disabled}
        />
      </Field>

      <Field label="Název" htmlFor={`${idPrefix}-name`} required>
        <Input
          id={`${idPrefix}-name`}
          value={values.name}
          onChange={(event) => onChange({ name: event.target.value })}
          placeholder="Automatizace fakturace"
          autoComplete="off"
          disabled={disabled}
        />
      </Field>

      <Field label="Popis" htmlFor={`${idPrefix}-description`}>
        <Textarea
          id={`${idPrefix}-description`}
          value={values.description}
          onChange={(event) => onChange({ description: event.target.value })}
          rows={3}
          placeholder="Rozsah projektu, cíl, kontext"
          disabled={disabled}
        />
      </Field>

      <Field label="Status" htmlFor={`${idPrefix}-status`}>
        <Select
          id={`${idPrefix}-status`}
          value={values.status}
          onValueChange={(value) => onChange({ status: value })}
          options={statusOptions}
          disabled={disabled}
        />
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Zahájení" htmlFor={`${idPrefix}-started`}>
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <DatePicker
                id={`${idPrefix}-started`}
                value={values.startedAt.length > 0 ? values.startedAt : null}
                onChange={(iso) => onChange({ startedAt: iso })}
              />
            </div>
            {values.startedAt.length > 0 ? (
              <ClearButton onClick={() => onChange({ startedAt: "" })} />
            ) : null}
          </div>
        </Field>
        <Field label="Termín" htmlFor={`${idPrefix}-due`}>
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <DatePicker
                id={`${idPrefix}-due`}
                value={values.dueAt.length > 0 ? values.dueAt : null}
                onChange={(iso) => onChange({ dueAt: iso })}
              />
            </div>
            {values.dueAt.length > 0 ? (
              <ClearButton onClick={() => onChange({ dueAt: "" })} />
            ) : null}
          </div>
        </Field>
      </div>

      <Field label="Budget (Kč)" htmlFor={`${idPrefix}-budget`}>
        <Input
          id={`${idPrefix}-budget`}
          value={values.budget}
          onChange={(event) => onChange({ budget: event.target.value.replace(/\D/g, "") })}
          inputMode="numeric"
          placeholder="80000"
          autoComplete="off"
          disabled={disabled}
        />
      </Field>
    </div>
  )
}

function ClearButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-[13px] text-muted transition-colors hover:text-foreground"
    >
      Vymazat
    </button>
  )
}
