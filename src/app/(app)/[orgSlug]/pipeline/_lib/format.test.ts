import { describe, expect, it } from "vitest"
import {
  formatCzk,
  formatCzkCompact,
  formatDaysInStage,
  formatPercent,
} from "@/app/(app)/[orgSlug]/pipeline/_lib/format"

// The UI separates thousands and units with a non-breaking space, so an amount never
// wraps between the number and "Kč".
const NBSP = " "

describe("formatCzk", () => {
  it("groups thousands and appends Kč", () => {
    expect(formatCzk(80_000)).toBe(`80${NBSP}000${NBSP}Kč`)
    expect(formatCzk(1_234_567)).toBe(`1${NBSP}234${NBSP}567${NBSP}Kč`)
    expect(formatCzk(0)).toBe(`0${NBSP}Kč`)
  })

  it("rounds to whole crowns and keeps the sign", () => {
    expect(formatCzk(999.6)).toBe(`1${NBSP}000${NBSP}Kč`)
    expect(formatCzk(-25_000)).toBe(`-25${NBSP}000${NBSP}Kč`)
  })
})

describe("formatCzkCompact", () => {
  it("shortens to thousands and millions", () => {
    expect(formatCzkCompact(1_250_000)).toBe(`1,3${NBSP}mil.`)
    expect(formatCzkCompact(12_000_000)).toBe(`12${NBSP}mil.`)
    expect(formatCzkCompact(45_400)).toBe(`45${NBSP}tis.`)
    expect(formatCzkCompact(900)).toBe("900")
  })
})

describe("formatPercent", () => {
  it("keeps the percent sign on the same line", () => {
    expect(formatPercent(40)).toBe(`40${NBSP}%`)
  })
})

describe("formatDaysInStage", () => {
  it("declines the Czech word for days", () => {
    expect(formatDaysInStage(1)).toBe(`1${NBSP}den ve fázi`)
    expect(formatDaysInStage(3)).toBe(`3${NBSP}dny ve fázi`)
    expect(formatDaysInStage(5)).toBe(`5${NBSP}dní ve fázi`)
  })
})
