import { describe, expect, it } from "vitest"
import { isOneOf } from "@/lib/literals"

const ROLES = ["owner", "admin", "member"] as const

describe("isOneOf", () => {
  it("accepts a member of the tuple with its exact spelling", () => {
    expect(isOneOf(ROLES, "admin")).toBe(true)
  })

  it("rejects other spellings and unknown values", () => {
    expect(isOneOf(ROLES, "Admin")).toBe(false)
    expect(isOneOf(ROLES, "")).toBe(false)
  })
})
