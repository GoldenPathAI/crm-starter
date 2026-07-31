"use client"

import { useState } from "react"
import { Field } from "@/app/_ui/Field"
import { Input } from "@/app/_ui/Input"
import { MultiSelect } from "@/app/_ui/MultiSelect"
import { Select } from "@/app/_ui/Select"
import { Textarea } from "@/app/_ui/Textarea"
import type { ClientStatus, ServiceKind } from "@/core/types/crm.types"
import { selectOptions, type EnumView } from "../_lib/enums"

export interface ClientFieldErrors {
  name?: string
  industry?: string
}

export interface ClientFieldValues {
  name?: string
  industry?: string
  street?: string
  city?: string
  zip?: string
  ico?: string
  dic?: string
  website?: string
  billingEmail?: string
  status?: ClientStatus
  services?: ServiceKind[]
  mrrCzk?: number
  nextStep?: string
  note?: string
  labels?: string[]
}

interface ClientFormFieldsProps {
  idPrefix: string
  statusView: EnumView
  serviceView: EnumView
  initial?: ClientFieldValues
  // Fast-add mode for the create screen: only the fields needed to start a client.
  // IČO, web, paušál and poznámka are filled later on the client detail. Full form
  // (edit dialog) leaves this off.
  essential?: boolean
  // Inline required-field errors owned by the parent form (used with a noValidate
  // form). When absent, the native `required` validation applies.
  errors?: ClientFieldErrors
  onErrorClear?: (field: keyof ClientFieldErrors) => void
}

const defaultStatusValue = (statusView: EnumView): string => {
  const inquiry = statusView.options.find((option) => option.semantic === "inquiry")
  return inquiry?.value ?? statusView.options[0]?.value ?? ""
}

export function ClientFormFields({
  idPrefix,
  statusView,
  serviceView,
  initial,
  essential = false,
  errors,
  onErrorClear,
}: ClientFormFieldsProps) {
  const [status, setStatus] = useState<string>(initial?.status ?? defaultStatusValue(statusView))
  const [services, setServices] = useState<string[]>(initial?.services ?? [])

  const id = (name: string) => `${idPrefix}-${name}`

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <Field label="Název" htmlFor={id("name")} required error={errors?.name}>
          <Input
            id={id("name")}
            name="name"
            defaultValue={initial?.name}
            placeholder="Nábytek Vranský s.r.o."
            required
            autoComplete="off"
            aria-invalid={errors?.name !== undefined}
            onChange={(event) => {
              if (event.target.value.trim().length > 0) {
                onErrorClear?.("name")
              }
            }}
          />
        </Field>
      </div>

      <Field label="Obor" htmlFor={id("industry")} required error={errors?.industry}>
        <Input
          id={id("industry")}
          name="industry"
          defaultValue={initial?.industry}
          placeholder="Výroba nábytku"
          required
          autoComplete="off"
          aria-invalid={errors?.industry !== undefined}
          onChange={(event) => {
            if (event.target.value.trim().length > 0) {
              onErrorClear?.("industry")
            }
          }}
        />
      </Field>
      <Field label="Město" htmlFor={id("city")}>
        <Input
          id={id("city")}
          name="city"
          defaultValue={initial?.city}
          placeholder="Brno"
          autoComplete="off"
        />
      </Field>

      {!essential ? (
        <>
          <Field label="Ulice a č. p." htmlFor={id("street")}>
            <Input
              id={id("street")}
              name="street"
              defaultValue={initial?.street}
              placeholder="Školská 660/3"
              autoComplete="off"
            />
          </Field>
          <Field label="PSČ" htmlFor={id("zip")}>
            <Input
              id={id("zip")}
              name="zip"
              defaultValue={initial?.zip}
              placeholder="110 00"
              inputMode="numeric"
              autoComplete="off"
            />
          </Field>
          <Field label="IČO" htmlFor={id("ico")}>
            <Input
              id={id("ico")}
              name="ico"
              defaultValue={initial?.ico}
              placeholder="12345678"
              inputMode="numeric"
              autoComplete="off"
            />
          </Field>
          <Field label="DIČ" htmlFor={id("dic")}>
            <Input
              id={id("dic")}
              name="dic"
              defaultValue={initial?.dic}
              placeholder="CZ12345678"
              autoComplete="off"
            />
          </Field>
          <Field label="Web" htmlFor={id("website")}>
            <Input
              id={id("website")}
              name="website"
              defaultValue={initial?.website}
              placeholder="nabytek-vransky.cz"
              autoComplete="off"
            />
          </Field>
          <Field label="Fakturační e-mail" htmlFor={id("billingEmail")}>
            <Input
              id={id("billingEmail")}
              name="billingEmail"
              type="email"
              defaultValue={initial?.billingEmail}
              placeholder="fakturace@firma.cz"
              autoComplete="off"
            />
          </Field>
        </>
      ) : null}

      <Field label="Status" htmlFor={id("status")}>
        <Select
          id={id("status")}
          value={status}
          onValueChange={setStatus}
          options={selectOptions(statusView)}
        />
        <input type="hidden" name="status" value={status} />
      </Field>
      {!essential ? (
        <Field label="Měsíční paušál (Kč)" htmlFor={id("mrrCzk")}>
          <Input
            id={id("mrrCzk")}
            name="mrrCzk"
            defaultValue={initial?.mrrCzk}
            placeholder="30000"
            inputMode="numeric"
            autoComplete="off"
          />
        </Field>
      ) : null}

      <div className="sm:col-span-2">
        <Field label="Služby" htmlFor={id("services")}>
          <MultiSelect
            id={id("services")}
            values={services}
            onChange={setServices}
            options={selectOptions(serviceView)}
            placeholder="Vyberte služby"
          />
          {services.map((service) => (
            <input key={service} type="hidden" name="services" value={service} />
          ))}
        </Field>
      </div>

      <div className="sm:col-span-2">
        <Field label="Další krok" htmlFor={id("nextStep")}>
          <Input
            id={id("nextStep")}
            name="nextStep"
            defaultValue={initial?.nextStep}
            placeholder="Poslat návrh smlouvy"
            autoComplete="off"
          />
        </Field>
      </div>

      {!essential ? (
        <div className="sm:col-span-2">
          <Field label="Štítky" htmlFor={id("labels")} hint="Oddělené čárkou">
            <Input
              id={id("labels")}
              name="labels"
              defaultValue={initial?.labels?.join(", ")}
              placeholder="vip, inbound, praha"
              autoComplete="off"
            />
          </Field>
        </div>
      ) : null}

      {!essential ? (
        <div className="sm:col-span-2">
          <Field label="Poznámka" htmlFor={id("note")}>
            <Textarea
              id={id("note")}
              name="note"
              rows={3}
              defaultValue={initial?.note}
              placeholder="Kontext, interní poznámky, na co si dát pozor"
            />
          </Field>
        </div>
      ) : null}
    </div>
  )
}
