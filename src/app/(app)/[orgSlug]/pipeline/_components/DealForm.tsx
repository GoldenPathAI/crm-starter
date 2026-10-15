"use client"

import { useState, type FormEvent } from "react"
import { Button } from "@/app/_ui/Button"
import { DatePicker } from "@/app/_ui/DatePicker"
import { DialogClose, DialogFooter } from "@/app/_ui/Dialog"
import { Field } from "@/app/_ui/Field"
import { Input } from "@/app/_ui/Input"
import { Select } from "@/app/_ui/Select"
import { Spinner } from "@/app/_ui/Spinner"
import { Textarea } from "@/app/_ui/Textarea"
import { AvatarStack } from "@/app/_components/AvatarStack"
import { AssigneePicker } from "@/app/_components/AssigneePicker"
import { UserPlus } from "lucide-react"
import type { DealStage, EnumOption, OrgMember } from "@/core/types/crm.types"
import type { ClientOption } from "@/lib/crm/store/deals"
import type { DealFormValues } from "../_lib/types"
import { ClientCombobox } from "./ClientCombobox"

export interface DealFormInitial {
  clientId: string
  title: string
  valueCzk: number
  stage: DealStage
  probability?: number
  expectedClose?: string
  nextStep?: string
  offerUrl?: string
}

interface DealFormProps {
  idPrefix: string
  clientOptions: ClientOption[]
  stageOptions: EnumOption[]
  initial?: DealFormInitial
  includeStage: boolean
  // The offer link lives on an existing deal, so the field only shows in the edit
  // dialog. The create store does not persist it, so the new-deal form omits it.
  includeOfferUrl?: boolean
  submitLabel: string
  pending: boolean
  onSubmit: (values: DealFormValues, stage: DealStage) => void
  members?: OrgMember[]
  assigneeIds?: string[]
  onAssigneeIdsChange?: (userIds: string[]) => void
}

interface FormErrors {
  clientId?: string
  title?: string
  valueCzk?: string
}

export function DealForm({
  idPrefix,
  clientOptions,
  stageOptions,
  initial,
  includeStage,
  includeOfferUrl = false,
  submitLabel,
  pending,
  onSubmit,
  members,
  assigneeIds,
  onAssigneeIdsChange,
}: DealFormProps) {
  const showAssignees =
    members !== undefined && assigneeIds !== undefined && onAssigneeIdsChange !== undefined
  const selectedAssignees =
    members !== undefined && assigneeIds !== undefined
      ? assigneeIds
          .map((id) => members.find((member) => member.userId === id))
          .filter((member): member is OrgMember => member !== undefined)
      : []
  const toggleAssignee = (userId: string) => {
    if (assigneeIds === undefined || onAssigneeIdsChange === undefined) {
      return
    }

    onAssigneeIdsChange(
      assigneeIds.includes(userId)
        ? assigneeIds.filter((id) => id !== userId)
        : [...assigneeIds, userId],
    )
  }

  // Suggested win probability per stage seeds the slider so Filip rarely touches it and
  // keeps the weighted-pipeline number honest without a free-text field to fat-finger.
  const stageProbability = (value: string): number =>
    stageOptions.find((option) => option.value === value)?.defaultProbability ?? 0
  const isDealStage = (value: string): value is DealStage =>
    stageOptions.some((option) => option.value === value)
  const defaultStageValue =
    stageOptions.find((option) => option.semantic === "open")?.value ??
    stageOptions[0]?.value ??
    ""

  const [clientId, setClientId] = useState(initial?.clientId ?? "")
  const [title, setTitle] = useState(initial?.title ?? "")
  const [valueCzk, setValueCzk] = useState(initial !== undefined ? String(initial.valueCzk) : "")
  const [stage, setStage] = useState<DealStage>(initial?.stage ?? defaultStageValue)
  const [probability, setProbability] = useState<number>(
    initial?.probability ?? stageProbability(initial?.stage ?? defaultStageValue),
  )
  const [probabilityTouched, setProbabilityTouched] = useState(false)
  const [expectedClose, setExpectedClose] = useState<string | null>(initial?.expectedClose ?? null)
  const [nextStep, setNextStep] = useState(initial?.nextStep ?? "")
  const [offerUrl, setOfferUrl] = useState(initial?.offerUrl ?? "")
  const [errors, setErrors] = useState<FormErrors>({})

  const stageSelectOptions = stageOptions.map((option) => ({
    value: option.value,
    label: option.label,
  }))

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    const nextErrors: FormErrors = {}
    if (clientId.trim().length === 0) {
      nextErrors.clientId = "Vyberte klienta."
    }

    if (title.trim().length === 0) {
      nextErrors.title = "Vyplňte název dealu."
    }

    const valueNumber = valueCzk.trim().length === 0 ? Number.NaN : Number(valueCzk)
    if (!Number.isFinite(valueNumber) || valueNumber < 0) {
      nextErrors.valueCzk = "Zadejte nezápornou hodnotu."
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)

      return
    }

    setErrors({})
    onSubmit(
      {
        clientId: clientId.trim(),
        title: title.trim(),
        valueCzk: valueNumber,
        probability,
        expectedClose,
        nextStep: nextStep.trim().length > 0 ? nextStep.trim() : null,
        offerUrl: offerUrl.trim().length > 0 ? offerUrl.trim() : null,
      },
      stage,
    )
  }

  const handleStageChange = (value: string) => {
    if (!isDealStage(value)) {
      return
    }

    setStage(value)
    if (!probabilityTouched) {
      setProbability(stageProbability(value))
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Field label="Klient" htmlFor={`${idPrefix}-client`} required error={errors.clientId}>
        <ClientCombobox
          id={`${idPrefix}-client`}
          options={clientOptions}
          value={clientId}
          onChange={setClientId}
          invalid={errors.clientId !== undefined}
        />
      </Field>
      <Field label="Název dealu" htmlFor={`${idPrefix}-title`} required error={errors.title}>
        <Input
          id={`${idPrefix}-title`}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Rozšíření automatizace fakturace"
          autoComplete="off"
          aria-invalid={errors.title !== undefined}
        />
      </Field>
      <Field label="Hodnota (Kč)" htmlFor={`${idPrefix}-value`} required error={errors.valueCzk}>
        <Input
          id={`${idPrefix}-value`}
          value={valueCzk}
          onChange={(event) => setValueCzk(event.target.value)}
          inputMode="numeric"
          placeholder="180000"
          autoComplete="off"
          aria-invalid={errors.valueCzk !== undefined}
        />
      </Field>
      {includeStage ? (
        <Field label="Fáze" htmlFor={`${idPrefix}-stage`}>
          <Select
            id={`${idPrefix}-stage`}
            value={stage}
            onValueChange={handleStageChange}
            options={stageSelectOptions}
          />
        </Field>
      ) : null}
      <Field label="Pravděpodobnost uzavření" htmlFor={`${idPrefix}-probability`}>
        <div className="flex items-center gap-4">
          <input
            id={`${idPrefix}-probability`}
            type="range"
            min={0}
            max={100}
            step={5}
            value={probability}
            onChange={(event) => {
              setProbability(Number(event.target.value))
              setProbabilityTouched(true)
            }}
            aria-valuetext={`${probability} %`}
            className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-surface-3 accent-primary"
          />
          <span className="w-11 shrink-0 text-right text-[15px] font-semibold tabular-nums text-foreground">
            {probability} %
          </span>
        </div>
      </Field>
      <Field label="Očekávané uzavření" htmlFor={`${idPrefix}-close`}>
        <DatePicker
          id={`${idPrefix}-close`}
          value={expectedClose}
          onChange={(iso) => setExpectedClose(iso)}
        />
      </Field>
      <Field label="Další krok" htmlFor={`${idPrefix}-next`}>
        <Textarea
          id={`${idPrefix}-next`}
          value={nextStep}
          onChange={(event) => setNextStep(event.target.value)}
          rows={2}
          placeholder="Poslat finální smlouvu"
        />
      </Field>
      {includeOfferUrl ? (
        <Field label="Odkaz na nabídku" htmlFor={`${idPrefix}-offer-url`}>
          <Input
            id={`${idPrefix}-offer-url`}
            type="url"
            value={offerUrl}
            onChange={(event) => setOfferUrl(event.target.value)}
            placeholder="https://example.com/nabidka/klient"
            autoComplete="off"
            inputMode="url"
          />
        </Field>
      ) : null}
      {showAssignees ? (
        <Field label="Řeší" htmlFor={`${idPrefix}-assignees`}>
          <AssigneePicker
            members={members}
            selected={assigneeIds}
            onToggle={toggleAssignee}
            onClear={() => onAssigneeIdsChange([])}
            trigger={
              <button
                type="button"
                id={`${idPrefix}-assignees`}
                className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-border-strong/60 px-4 py-2.5 text-[15px] transition-colors hover:border-border-strong"
              >
                {selectedAssignees.length > 0 ? (
                  <>
                    <AvatarStack members={selectedAssignees} />
                    <span className="truncate text-muted">
                      {selectedAssignees.map((member) => member.name).join(", ")}
                    </span>
                  </>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-muted-soft">
                    <UserPlus className="size-4" />
                    Přiřadit řešitele
                  </span>
                )}
              </button>
            }
          />
        </Field>
      ) : null}
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="ghost" size="sm">
            Zrušit
          </Button>
        </DialogClose>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? <Spinner className="size-4" /> : null}
          {submitLabel}
        </Button>
      </DialogFooter>
    </form>
  )
}
