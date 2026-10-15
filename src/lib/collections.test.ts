import { describe, expect, it } from "vitest"
import { insertAt, recordFromKeys, toggleMember } from "@/lib/collections"

describe("insertAt", () => {
  it("returns a new array with the item at the index", () => {
    const ids = ["a", "b", "c"]
    expect(insertAt(ids, 1, "x")).toEqual(["a", "x", "b", "c"])
    expect(insertAt(ids, 3, "x")).toEqual(["a", "b", "c", "x"])
    expect(ids).toEqual(["a", "b", "c"])
  })
})

describe("toggleMember", () => {
  it("adds a missing value and removes a present one without touching the input", () => {
    const selected = new Set(["a"])
    expect([...toggleMember(selected, "b")]).toEqual(["a", "b"])
    expect([...toggleMember(selected, "a")]).toEqual([])
    expect([...selected]).toEqual(["a"])
  })
})

describe("recordFromKeys", () => {
  it("builds a value for every key", () => {
    expect(recordFromKeys(["dnes", "tyden"] as const, (key) => key.length)).toEqual({
      dnes: 4,
      tyden: 5,
    })
  })
})
