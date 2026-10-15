import { describe, expect, it } from "vitest"
import {
  formatCzkCompact,
  formatDaysInStage,
  formatPercent,
} from "@/app/(app)/[orgSlug]/pipeline/_lib/format"

// The UI separates thousands and units with a non-breaking space, so an amount never
// wraps between the number and "Kč".
const NBSP = "\u00a0"

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
