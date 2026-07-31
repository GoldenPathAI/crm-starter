import { format, parseISO } from "date-fns"

const NBSP = String.fromCharCode(0x00a0)

// Day and month only, for the close-date chip on a card, e.g. "29. 7.".
export const formatShortDate = (iso: string): string => format(parseISO(iso), "d. M.")

export const formatCzk = (value: number): string => {
  const rounded = Math.round(value)
  const sign = rounded < 0 ? "-" : ""
  const digits = Math.abs(rounded)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, NBSP)
  return `${sign}${digits}${NBSP}Kč`
}

export const formatPercent = (value: number): string => `${value}${NBSP}%`

// Short currency for tight spots (the collapsed closed-stage rails), e.g. "1,3 mil.".
export const formatCzkCompact = (value: number): string => {
  const abs = Math.abs(value)
  if (abs >= 1_000_000) {
    const millions = value / 1_000_000
    return `${millions.toFixed(abs >= 10_000_000 ? 0 : 1).replace(".", ",")}${NBSP}mil.`
  }
  if (abs >= 1_000) {
    return `${Math.round(value / 1_000)}${NBSP}tis.`
  }
  return `${value}`
}

const dayWord = (days: number): string => {
  if (days === 1) {
    return "den"
  }
  if (days >= 2 && days <= 4) {
    return "dny"
  }
  return "dní"
}

export const formatDaysInStage = (days: number): string => `${days}${NBSP}${dayWord(days)} ve fázi`
