"use client"

import { useRouter } from "next/navigation"
import { useTransition } from "react"
import { Select } from "@/app/_ui/Select"
import { orgHref } from "@/lib/nav"

export interface EntityFilterOption {
  value: string
  label: string
}

interface HistoryFilterProps {
  orgSlug: string
  value: string
  options: readonly EntityFilterOption[]
}

const ALL_VALUE = "vse"

export function HistoryFilter({ orgSlug, value, options }: HistoryFilterProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const change = (next: string) => {
    const url = new URL(orgHref(orgSlug, "/nastaveni"), window.location.origin)
    url.searchParams.set("tab", "historie")
    if (next !== ALL_VALUE) {
      url.searchParams.set("entity", next)
    }

    startTransition(() => {
      router.push(`${url.pathname}${url.search}`)
    })
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-[13px] text-muted">Typ záznamu</span>
      <Select
        value={value === "" ? ALL_VALUE : value}
        onValueChange={change}
        options={[{ value: ALL_VALUE, label: "Vše" }, ...options]}
        disabled={isPending}
        className="h-9 w-56 rounded-lg text-sm"
      />
    </div>
  )
}
