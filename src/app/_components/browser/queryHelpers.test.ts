import { describe, expect, it } from "vitest"
import { SortDirection } from "@/core/types/query.types"
import {
  cleanIsoDate,
  cleanList,
  cleanText,
  enumList,
  matchEnum,
  parseGroupLevels,
  parsePage,
  parseSortDir,
  single,
} from "@/app/_components/browser/queryHelpers"

const GROUPS = ["status", "klient", "priorita"] as const

describe("single", () => {
  it("takes the first value of a repeated param", () => {
    expect(single(["a", "b"])).toBe("a")
    expect(single("a")).toBe("a")
    expect(single(undefined)).toBeUndefined()
  })
})

describe("matchEnum", () => {
  it("returns the value only when it is one of the allowed ones", () => {
    expect(matchEnum("klient", GROUPS)).toBe("klient")
    expect(matchEnum("Klient", GROUPS)).toBeUndefined()
    expect(matchEnum(undefined, GROUPS)).toBeUndefined()
  })
})

describe("cleanText", () => {
  it("trims and treats blank as absent", () => {
    expect(cleanText("  acme ")).toBe("acme")
    expect(cleanText("   ")).toBeUndefined()
    expect(cleanText(undefined)).toBeUndefined()
  })
})

describe("cleanList", () => {
  it("splits on commas, merges repeated params, trims and dedupes in order", () => {
    expect(cleanList(["b, a", "c", "a", " "])).toEqual(["b", "a", "c"])
    expect(cleanList(undefined)).toEqual([])
  })
})

describe("enumList", () => {
  it("keeps only allowed values", () => {
    expect(enumList("status,nesmysl,klient", GROUPS)).toEqual(["status", "klient"])
  })
})

describe("cleanIsoDate", () => {
  it("accepts yyyy-MM-dd only", () => {
    expect(cleanIsoDate(" 2026-10-15 ")).toBe("2026-10-15")
    expect(cleanIsoDate("15. 10. 2026")).toBeUndefined()
    expect(cleanIsoDate(undefined)).toBeUndefined()
  })
})

describe("parsePage", () => {
  it("falls back to the first page on anything that is not a positive integer", () => {
    expect(parsePage("3")).toBe(3)
    expect(parsePage("0")).toBe(1)
    expect(parsePage("-2")).toBe(1)
    expect(parsePage("abc")).toBe(1)
    expect(parsePage(undefined)).toBe(1)
  })
})

describe("parseSortDir", () => {
  it("is ascending unless the param says Desc", () => {
    expect(parseSortDir(SortDirection.Desc)).toBe(SortDirection.Desc)
    expect(parseSortDir("desc")).toBe(SortDirection.Asc)
    expect(parseSortDir(undefined)).toBe(SortDirection.Asc)
  })
})

describe("parseGroupLevels", () => {
  const options = { default: ["klient", "status"] as const, maxLevels: 2 }

  it("uses the default levels when the param is absent", () => {
    expect(parseGroupLevels(undefined, GROUPS, options)).toEqual(["klient", "status"])
  })

  it("reads none as explicitly ungrouped", () => {
    expect(parseGroupLevels("none", GROUPS, options)).toEqual([])
  })

  it("drops unknown levels and caps the depth", () => {
    expect(parseGroupLevels("priorita,nesmysl,status,klient", GROUPS, options)).toEqual([
      "priorita",
      "status",
    ])
  })
})
