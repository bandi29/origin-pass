import { describe, it, expect, vi, beforeEach } from "vitest"
import { createHmac } from "crypto"
import { verifyPaddleWebhook } from "./paddle-webhook"

describe("paddle-webhook", () => {
  const secretKey = "test-secret-key"
  const rawBody = '{"event":"subscription.created"}'

  function buildValidSignature(body: string = rawBody): string {
    const ts = Math.floor(Date.now() / 1000)
    const signedPayload = `${ts}:${body}`
    const h1 = createHmac("sha256", secretKey).update(signedPayload).digest("hex")
    return `ts=${ts};h1=${h1}`
  }

  beforeEach(() => {
    vi.useFakeTimers()
  })

  it("returns true for valid signature", () => {
    const header = buildValidSignature()
    vi.setSystemTime(new Date())
    expect(verifyPaddleWebhook(rawBody, header, secretKey)).toBe(true)
  })

  it("returns false when secretKey is empty", () => {
    const header = buildValidSignature()
    expect(verifyPaddleWebhook(rawBody, header, "")).toBe(false)
  })

  it("returns false when signatureHeader is empty", () => {
    expect(verifyPaddleWebhook(rawBody, "", secretKey)).toBe(false)
  })

  it("returns false when rawBody is empty", () => {
    const header = buildValidSignature()
    expect(verifyPaddleWebhook("", header, secretKey)).toBe(false)
  })

  it("returns false for invalid signature format (missing ts)", () => {
    expect(verifyPaddleWebhook(rawBody, "h1=abc123", secretKey)).toBe(false)
  })

  it("returns false for invalid signature format (missing h1)", () => {
    expect(verifyPaddleWebhook(rawBody, "ts=1234567890", secretKey)).toBe(false)
  })

  it("returns false for tampered body", () => {
    const header = buildValidSignature()
    expect(verifyPaddleWebhook('{"event":"tampered"}', header, secretKey)).toBe(false)
  })

  it("returns false for wrong secret", () => {
    const header = buildValidSignature()
    expect(verifyPaddleWebhook(rawBody, header, "wrong-secret")).toBe(false)
  })

  it("returns false for replay attack (timestamp too old)", () => {
    const ts = Math.floor(Date.now() / 1000) - 400 // 400 seconds ago
    const signedPayload = `${ts}:${rawBody}`
    const h1 = createHmac("sha256", secretKey).update(signedPayload).digest("hex")
    const header = `ts=${ts};h1=${h1}`
    expect(verifyPaddleWebhook(rawBody, header, secretKey)).toBe(false)
  })

  it("returns false for future timestamp (beyond tolerance)", () => {
    const ts = Math.floor(Date.now() / 1000) + 400
    const signedPayload = `${ts}:${rawBody}`
    const h1 = createHmac("sha256", secretKey).update(signedPayload).digest("hex")
    const header = `ts=${ts};h1=${h1}`
    expect(verifyPaddleWebhook(rawBody, header, secretKey)).toBe(false)
  })

  it("returns false when h1 length differs from expected", () => {
    const ts = Math.floor(Date.now() / 1000)
    const header = `ts=${ts};h1=short`
    expect(verifyPaddleWebhook(rawBody, header, secretKey)).toBe(false)
  })

  it("returns false when h1 contains invalid hex (triggers Buffer catch)", () => {
    const ts = Math.floor(Date.now() / 1000)
    const header = `ts=${ts};h1=zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz` // invalid hex, same length as sha256
    expect(verifyPaddleWebhook(rawBody, header, secretKey)).toBe(false)
  })
})
