import { differenceInCalendarDays, format, parseISO } from "date-fns"
import { cs } from "date-fns/locale"
import { todayIso } from "@/lib/crm/config"

const czk = new Intl.NumberFormat("cs-CZ", {
  style: "currency",
  currency: "CZK",
  maximumFractionDigits: 0,
})

export const formatCzk = (amount: number): string => czk.format(amount)

export const formatCzkOrDash = (amount: number | undefined): string =>
  amount === undefined ? "-" : czk.format(amount)

export const formatDate = (iso: string | undefined): string =>
  iso === undefined || iso.length === 0 ? "-" : format(parseISO(iso), "d. M. yyyy", { locale: cs })

export const relativeDate = (iso: string | undefined): string => {
  if (iso === undefined || iso.length === 0) {
    return "-"
  }
  const diff = differenceInCalendarDays(parseISO(todayIso()), parseISO(iso))
  if (diff < 0) {
    return formatDate(iso)
  }
  if (diff === 0) {
    return "dnes"
  }
  if (diff === 1) {
    return "včera"
  }
  if (diff <= 30) {
    return `před ${diff} dny`
  }
  return formatDate(iso)
}
