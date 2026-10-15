import { describe, expect, it } from "vitest"
import { businessToday, formatCzechDate, formatCzechDateTime, monthLabel, monthLabelShort } from "@/lib/dates"

describe("formatCzechDate", () => {
  it("formats an ISO date the Czech way and shows a dash for no date", () => {
    expect(formatCzechDate("2026-07-29")).toBe("29. 7. 2026")
    expect(formatCzechDate(null)).toBe("-")
    expect(formatCzechDate("")).toBe("-")
  })
})

describe("formatCzechDateTime", () => {
  it("adds the 24-hour time", () => {
    expect(formatCzechDateTime("2026-07-29T08:05:00")).toBe("29. 7. 2026 08:05")
  })
})

describe("businessToday", () => {
  it("is the calendar date in Prague, not on the server clock", () => {
    // 23:30 UTC on 1 March is already 2 March in Prague (UTC+1 in winter).
    expect(businessToday(new Date("2026-03-01T23:30:00Z"))).toBe("2026-03-02")
    expect(businessToday(new Date("2026-03-01T12:00:00Z"))).toBe("2026-03-01")
  })
})

describe("month labels", () => {
  it("names the month in Czech and keeps June and July apart when short", () => {
    expect(monthLabel("2026-06")).toBe("červen 2026")
    expect(monthLabelShort("2026-06")).toBe("čvn")
    expect(monthLabelShort("2026-07")).toBe("čvc")
  })
})
