import { describe, expect, it } from "vitest"
import { createScanRedirectToken, verifyScanRedirectToken } from "./scan-redirect-token"

describe("scan-redirect-token", () => {
  it("verifies token created for same passport", () => {
    const id = "550e8400-e29b-41d4-a716-446655440000"
    const { sk, skt } = createScanRedirectToken(id)
    expect(verifyScanRedirectToken(id, sk, skt)).toBe(true)
  })

  it("rejects wrong passport", () => {
    const { sk, skt } = createScanRedirectToken("550e8400-e29b-41d4-a716-446655440000")
    expect(verifyScanRedirectToken("6ba7b810-9dad-11d1-80b4-00c04fd430c8", sk, skt)).toBe(false)
  })

  it("rejects missing params", () => {
    expect(verifyScanRedirectToken("550e8400-e29b-41d4-a716-446655440000", undefined, "1")).toBe(false)
  })
})
