import { describe, expect, it } from "vitest"
import {
  createProductBodySchema,
  patchProductBodySchema,
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

  it("accepts quantity with bounds", () => {
    expect(
      qrcodeBodySchema.safeParse({
        passportId: "550e8400-e29b-41d4-a716-446655440000",
        quantity: 25,
      }).success
    ).toBe(true)
    expect(
      qrcodeBodySchema.safeParse({
        passportId: "550e8400-e29b-41d4-a716-446655440000",
        quantity: 0,
      }).success
    ).toBe(false)
  })
})

describe("patchProductBodySchema", () => {
  it("accepts complianceCategoryKey alone", () => {
    const r = patchProductBodySchema.safeParse({ complianceCategoryKey: "leather" })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.complianceCategoryKey).toBe("leather")
  })

  it("rejects invalid complianceCategoryKey", () => {
    expect(patchProductBodySchema.safeParse({ complianceCategoryKey: "invalid" }).success).toBe(false)
  })
})
