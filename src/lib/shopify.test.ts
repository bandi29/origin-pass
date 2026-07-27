import crypto from "node:crypto"
import { describe, expect, it, beforeEach, afterEach } from "vitest"
import {
  buildShopifyOAuthRedirectUri,
  getShopifyApiSecret,
  verifyShopifyHmac,
  verifyShopifyWebhook,
} from "@/lib/shopify"
import { readShopifyShopId } from "@/lib/shopify-webhook-handler"

const TEST_SECRET = "test-shopify-api-secret"

function signWebhookBody(body: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(body, "utf8").digest("base64")
}

describe("verifyShopifyWebhook", () => {
  const originalSecret = process.env.SHOPIFY_API_SECRET
  const originalSecretKey = process.env.SHOPIFY_API_SECRET_KEY

  beforeEach(() => {
    process.env.SHOPIFY_API_SECRET = TEST_SECRET
    delete process.env.SHOPIFY_API_SECRET_KEY
  })

  afterEach(() => {
    process.env.SHOPIFY_API_SECRET = originalSecret
    if (originalSecretKey === undefined) {
      delete process.env.SHOPIFY_API_SECRET_KEY
    } else {
      process.env.SHOPIFY_API_SECRET_KEY = originalSecretKey
    }
  })

  it("accepts a valid HMAC over the raw body", () => {
    const body = JSON.stringify({ shop_id: 123, shop_domain: "brand.myshopify.com" })
    const hmac = signWebhookBody(body, TEST_SECRET)
    expect(verifyShopifyWebhook(body, hmac)).toBe(true)
  })

  it("rejects an invalid HMAC", () => {
    const body = '{"shop_id":123}'
    expect(verifyShopifyWebhook(body, "invalid-signature")).toBe(false)
  })

  it("rejects when the secret is missing", () => {
    delete process.env.SHOPIFY_API_SECRET
    delete process.env.SHOPIFY_API_SECRET_KEY
    const body = '{"shop_id":123}'
    const hmac = signWebhookBody(body, TEST_SECRET)
    expect(verifyShopifyWebhook(body, hmac)).toBe(false)
  })

  it("accepts SHOPIFY_API_SECRET_KEY when SHOPIFY_API_SECRET is unset", () => {
    delete process.env.SHOPIFY_API_SECRET
    process.env.SHOPIFY_API_SECRET_KEY = TEST_SECRET
    const body = JSON.stringify({ shop_id: 123 })
    const hmac = signWebhookBody(body, TEST_SECRET)
    expect(verifyShopifyWebhook(body, hmac)).toBe(true)
    expect(getShopifyApiSecret()).toBe(TEST_SECRET)
  })

  it("rejects tampered bodies (timing-safe compare)", () => {
    const body = '{"shop_id":123}'
    const hmac = signWebhookBody(body, TEST_SECRET)
    expect(verifyShopifyWebhook('{"shop_id":124}', hmac)).toBe(false)
  })

  it("rejects when the HMAC header is missing", () => {
    expect(verifyShopifyWebhook("{}", null)).toBe(false)
  })
})

describe("verifyShopifyHmac", () => {
  it("validates OAuth query-string HMAC", () => {
    const params = new URLSearchParams({
      code: "abc123",
      shop: "brand.myshopify.com",
      state: "nonce",
      timestamp: "1234567890",
    })
    const message = [...params.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join("&")
    const hmac = crypto.createHmac("sha256", TEST_SECRET).update(message).digest("hex")
    params.set("hmac", hmac)
    expect(verifyShopifyHmac(params, TEST_SECRET)).toBe(true)
  })
})

describe("readShopifyShopId", () => {
  it("reads numeric and string shop ids", () => {
    expect(readShopifyShopId({ shop_id: 954889 })).toBe(954889)
    expect(readShopifyShopId({ shop_id: "954889" })).toBe(954889)
    expect(readShopifyShopId({})).toBeNull()
  })
})

describe("buildShopifyOAuthRedirectUri", () => {
  const envKeys = [
    "HOST",
    "SHOPIFY_APP_URL",
    "SHOPIFY_OAUTH_REDIRECT_ORIGIN",
    "SHOPIFY_ALLOW_TUNNEL_OAUTH",
  ] as const
  const saved: Record<string, string | undefined> = {}

  beforeEach(() => {
    for (const key of envKeys) {
      saved[key] = process.env[key]
      delete process.env[key]
    }
  })

  afterEach(() => {
    for (const key of envKeys) {
      if (saved[key] === undefined) delete process.env[key]
      else process.env[key] = saved[key]
    }
  })

  it("defaults to the Partner-whitelisted production callback (not the rotating tunnel)", () => {
    process.env.HOST = "https://mineral-butler-resolution-secret.trycloudflare.com"
    expect(buildShopifyOAuthRedirectUri("http://localhost:3000")).toBe(
      "https://origin-pass.vercel.app/api/shopify/auth/callback",
    )
  })

  it("uses the tunnel only when SHOPIFY_ALLOW_TUNNEL_OAUTH=1", () => {
    process.env.HOST = "https://mineral-butler-resolution-secret.trycloudflare.com"
    process.env.SHOPIFY_ALLOW_TUNNEL_OAUTH = "1"
    expect(buildShopifyOAuthRedirectUri("http://localhost:3000")).toBe(
      "https://mineral-butler-resolution-secret.trycloudflare.com/api/shopify/auth/callback",
    )
  })

  it("honors SHOPIFY_OAUTH_REDIRECT_ORIGIN override", () => {
    process.env.SHOPIFY_OAUTH_REDIRECT_ORIGIN = "https://origin-pass.vercel.app"
    process.env.HOST = "https://some-tunnel.trycloudflare.com"
    expect(buildShopifyOAuthRedirectUri("http://localhost:3000")).toBe(
      "https://origin-pass.vercel.app/api/shopify/auth/callback",
    )
  })
})
