import { describe, expect, it } from "vitest"
import { formatCzk, formatCzkOrDash } from "@/lib/money"

// Thousands and the unit are separated by a non-breaking space, so an amount never
// wraps between the number and "Kč".
const NBSP = "\u00a0"

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

describe("formatCzkOrDash", () => {
  it("shows a dash for a missing amount", () => {
    expect(formatCzkOrDash(undefined)).toBe("-")
    expect(formatCzkOrDash(12_500)).toBe(`12${NBSP}500${NBSP}Kč`)
  })
})
