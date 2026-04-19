import { describe, expect, it } from "vitest"
import {
  createProductBodySchema,
  passportUpsertBodySchema,
  qrcodeBodySchema,
} from "./passport-wizard-schemas"

describe("createProductBodySchema", () => {
  it("requires name min length 3", () => {
    expect(createProductBodySchema.safeParse({ name: "ab" }).success).toBe(false)
    expect(createProductBodySchema.safeParse({ name: "abc" }).success).toBe(true)
  })
})

describe("passportUpsertBodySchema", () => {
  it("accepts valid product id and optional arrays", () => {
    const r = passportUpsertBodySchema.safeParse({
      productId: "550e8400-e29b-41d4-a716-446655440000",
      story: "Hello",
      materials: [{ name: "Cotton" }],
      timeline: [],
    })
    expect(r.success).toBe(true)
  })
})

describe("qrcodeBodySchema", () => {
  it("requires uuid passportId", () => {
    expect(qrcodeBodySchema.safeParse({ passportId: "not-a-uuid" }).success).toBe(false)
    expect(
      qrcodeBodySchema.safeParse({ passportId: "550e8400-e29b-41d4-a716-446655440000" }).success
    ).toBe(true)
  })
})
