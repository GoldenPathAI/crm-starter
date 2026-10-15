import { differenceInCalendarDays, format, parseISO } from "date-fns"
import { cs } from "date-fns/locale"
import { config } from "@/lib/config"

const CZECH_MONTHS = [
  "leden",
  "únor",
  "březen",
  "duben",
  "květen",
  "červen",
  "červenec",
  "srpen",
  "září",
  "říjen",
  "listopad",
  "prosinec",
] as const

export const todayIso = (): string => format(new Date(), "yyyy-MM-dd")

// Today's calendar date in the configured business timezone as yyyy-MM-dd, independent
// of the server's own timezone (en-CA formats the parts in exactly that order).
export const businessToday = (now: Date = new Date()): string =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: config.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now)

export const formatCzechDate = (iso: string | null): string => {
  if (iso === null || iso.length === 0) {
    return "-"
  }

  return format(parseISO(iso), "d. M. yyyy", { locale: cs })
}

export const formatCzechDateTime = (iso: string | null): string => {
  if (iso === null || iso.length === 0) {
    return "-"
  }

  return format(parseISO(iso), "d. M. yyyy HH:mm", { locale: cs })
}

export const monthKey = (iso: string): string => iso.slice(0, 7)

export const monthLabel = (key: string): string => {
  const [year, month] = key.split("-")
  const index = Number(month) - 1
  const name = CZECH_MONTHS[index] ?? key

  return `${name} ${year}`
}

// Distinct 3-letter abbreviations for chart axes: 12 full "leden 2026" labels never
// fit a chart card at any width. červen/červenec must not collapse to the same "čer".
const CZECH_MONTHS_SHORT = [
  "led",
  "úno",
  "bře",
  "dub",
  "kvě",
  "čvn",
  "čvc",
  "srp",
  "zář",
  "říj",
  "lis",
  "pro",
] as const

export const monthLabelShort = (key: string): string => {
  const [, month] = key.split("-")

  return CZECH_MONTHS_SHORT[Number(month) - 1] ?? key
}

export const daysUntil = (iso: string | null): number | null => {
  if (iso === null || iso.length === 0) {
    return null
  }

  return differenceInCalendarDays(parseISO(iso), new Date())
}
