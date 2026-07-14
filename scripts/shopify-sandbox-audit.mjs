#!/usr/bin/env node
/**
 * Security + load audit for OriginPass Shopify sandbox embed.
 * Run while `npm run shopify:dev` is active.
 *
 * Targets the same routes the admin iframe loads:
 *   https://admin.shopify.com/store/originpass-sandbox/apps/originpass/
 */
import crypto from "node:crypto"
import { execSync } from "node:child_process"
import { readFileSync, existsSync } from "node:fs"
import { resolve } from "node:path"

const shop = process.env.SHOPIFY_DEV_STORE || "originpass-sandbox.myshopify.com"
const host =
  process.env.SHOPIFY_EMBED_HOST ||
  "YWRtaW4uc2hvcGlmeS5jb20vc3RvcmUvb3JpZ2lucGFzcy1zYW5kYm94"
const embedQuery = `embedded=1&shop=${encodeURIComponent(shop)}&host=${encodeURIComponent(host)}`
const P95_TARGET_MS = Number(process.env.SHOPIFY_P95_TARGET_MS || 500)
const LOAD_CONCURRENCY = Number(process.env.SHOPIFY_LOAD_CONCURRENCY || 20)
const LOAD_REQUESTS = Number(process.env.SHOPIFY_LOAD_REQUESTS || 100)

function loadEnvSecret() {
  const envPath = resolve(process.cwd(), ".env.local")
  if (!existsSync(envPath)) return undefined
  const text = readFileSync(envPath, "utf8")
  for (const line of text.split("\n")) {
    const m = line.match(/^SHOPIFY_API_SECRET=(.+)$/)
    if (m) return m[1].trim().replace(/^["']|["']$/g, "")
    const m2 = line.match(/^SHOPIFY_API_SECRET_KEY=(.+)$/)
    if (m2) return m2[1].trim().replace(/^["']|["']$/g, "")
  }
  return process.env.SHOPIFY_API_SECRET || process.env.SHOPIFY_API_SECRET_KEY
}

function detectBaseUrl() {
  if (process.env.SHOPIFY_AUDIT_BASE_URL) return process.env.SHOPIFY_AUDIT_BASE_URL.replace(/\/$/, "")

  const candidates = ["http://localhost:3000"]
  try {
    const out = execSync("lsof -nP -iTCP -sTCP:LISTEN 2>/dev/null", { encoding: "utf8", timeout: 5000 })
    for (const line of out.split("\n")) {
      if (!line.startsWith("node")) continue
      const match = line.match(/:(\d+)\s+\(LISTEN\)/)
      if (!match) continue
      const port = Number(match[1])
      if (port === 3000 || port === 3457) continue
      candidates.push(`http://localhost:${port}`)
    }
  } catch {
    // ignore
  }

  for (const base of candidates) {
    try {
      const body = execSync(`curl -s "${base}/?${embedQuery}"`, { encoding: "utf8", timeout: 10000, maxBuffer: 5_000_000 })
      if (body.includes("Store configuration")) return base
    } catch {
      // try next
    }
  }

  return candidates[0]
}

function percentile(sorted, p) {
  if (!sorted.length) return 0
  const idx = Math.ceil((p / 100) * sorted.length) - 1
  return sorted[Math.max(0, idx)]
}

async function timedFetch(url, init) {
  const start = performance.now()
  const res = await fetch(url, init)
  const ms = performance.now() - start
  return { res, ms }
}

async function loadTest(label, url, { concurrency, total }) {
  const latencies = []
  let errors = 0
  let ok = 0
  let cursor = 0

  async function worker() {
    while (cursor < total) {
      cursor += 1
      try {
        const { res, ms } = await timedFetch(url, { method: "GET", redirect: "manual" })
        latencies.push(ms)
        if (res.status >= 200 && res.status < 400) ok += 1
        else errors += 1
      } catch {
        errors += 1
      }
    }
  }

  const started = performance.now()
  await Promise.all(Array.from({ length: concurrency }, () => worker()))
  const elapsed = performance.now() - started
  latencies.sort((a, b) => a - b)

  return {
    label,
    url,
    total,
    concurrency,
    elapsedMs: Math.round(elapsed),
    ok,
    errors,
    p50: Math.round(percentile(latencies, 50)),
    p95: Math.round(percentile(latencies, 95)),
    p99: Math.round(percentile(latencies, 99)),
    max: Math.round(latencies[latencies.length - 1] || 0),
  }
}

function signWebhook(body, secret) {
  return crypto.createHmac("sha256", secret).update(body, "utf8").digest("base64")
}

async function securityChecks(baseUrl, secret) {
  const results = []
  const push = (name, pass, detail) => results.push({ name, pass, detail })

  const embedUrl = `${baseUrl}/?${embedQuery}`
  const embed = await timedFetch(embedUrl, { method: "GET" })
  const xfo = embed.res.headers.get("x-frame-options")?.toLowerCase()
  const bodyText = await embed.res.text()
  push(
    "Embedded home returns 200 with app shell",
    embed.res.status === 200 && bodyText.includes("Store configuration"),
    `status=${embed.res.status}, ${embed.ms.toFixed(0)}ms`,
  )
  push(
    "Embed route is iframe-safe (no SAMEORIGIN X-Frame-Options)",
    xfo !== "sameorigin",
    xfo ? `X-Frame-Options: ${xfo}` : "no X-Frame-Options header",
  )

  const webhookUrl = `${baseUrl}/api/shopify/webhooks`
  const body = JSON.stringify({ id: 123, title: "Audit product" })

  const noHmac = await timedFetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Shop-Domain": shop,
      "X-Shopify-Topic": "products/update",
    },
    body,
  })
  push("Webhook rejects missing HMAC (401)", noHmac.res.status === 401, `status=${noHmac.res.status}`)

  const badHmac = await timedFetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Hmac-Sha256": "invalid",
      "X-Shopify-Shop-Domain": shop,
      "X-Shopify-Topic": "products/update",
    },
    body,
  })
  push("Webhook rejects invalid HMAC (401)", badHmac.res.status === 401, `status=${badHmac.res.status}`)

  if (secret) {
    const tamperedBody = JSON.stringify({ id: 124, title: "Tampered" })
    const goodSig = signWebhook(body, secret)
    const tampered = await timedFetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Hmac-Sha256": goodSig,
        "X-Shopify-Shop-Domain": shop,
        "X-Shopify-Topic": "products/update",
      },
      body: tamperedBody,
    })
    push("Webhook rejects tampered body (401)", tampered.res.status === 401, `status=${tampered.res.status}`)

    const valid = await timedFetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Hmac-Sha256": goodSig,
        "X-Shopify-Shop-Domain": shop,
        "X-Shopify-Topic": "products/update",
      },
      body,
    })
    push("Webhook accepts valid HMAC (200)", valid.res.status === 200, `status=${valid.res.status}`)
  } else {
    push("Webhook valid-signature test", false, "SHOPIFY_API_SECRET missing in .env.local")
  }

  const ssrfShop = await timedFetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Hmac-Sha256": "invalid",
      "X-Shopify-Shop-Domain": "evil.example.com",
      "X-Shopify-Topic": "products/update",
    },
    body,
  })
  push(
    "Webhook rejects invalid shop domain (401)",
    ssrfShop.res.status === 401,
    `status=${ssrfShop.res.status}`,
  )

  const gdprUrl = `${baseUrl}/api/webhooks/gdpr/shop_redact`
  const gdprNoHmac = await timedFetch(gdprUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ shop_domain: shop }),
  })
  push("GDPR shop_redact rejects missing HMAC (401)", gdprNoHmac.res.status === 401, `status=${gdprNoHmac.res.status}`)

  return results
}

async function main() {
  const baseUrl = detectBaseUrl()
  const secret = loadEnvSecret()

  console.log("OriginPass Shopify sandbox audit")
  console.log(`Admin entry: https://admin.shopify.com/store/originpass-sandbox/apps/originpass/`)
  console.log(`Dev store:   ${shop}`)
  console.log(`Test base:   ${baseUrl}`)
  console.log(`P95 target:  ${P95_TARGET_MS}ms (Shopify embedded app guideline)\n`)

  console.log("=== Security checks ===")
  const security = await securityChecks(baseUrl, secret)
  let secFail = 0
  for (const row of security) {
    console.log(`[${row.pass ? "PASS" : "FAIL"}] ${row.name}`)
    console.log(`       ${row.detail}`)
    if (!row.pass) secFail += 1
  }

  console.log("\n=== Load tests ===")
  const embedUrl = `${baseUrl}/?${embedQuery}`
  const embedLoad = await loadTest("Embedded app home (iframe entry)", embedUrl, {
    concurrency: LOAD_CONCURRENCY,
    total: LOAD_REQUESTS,
  })
  const healthLoad = await loadTest("Shopify app health route", `${baseUrl}/api/shopify?shop=${encodeURIComponent(shop)}&host=x`, {
    concurrency: LOAD_CONCURRENCY,
    total: Math.min(LOAD_REQUESTS, 60),
  })

  for (const row of [embedLoad, healthLoad]) {
    const p95Ok = row.p95 <= P95_TARGET_MS
    console.log(`\n${row.label}`)
    console.log(`  requests=${row.total} concurrency=${row.concurrency} elapsed=${row.elapsedMs}ms`)
    console.log(`  ok=${row.ok} errors=${row.errors}`)
    console.log(`  p50=${row.p50}ms p95=${row.p95}ms p99=${row.p99}ms max=${row.max}ms`)
    console.log(`  [${p95Ok ? "PASS" : "WARN"}] p95 vs ${P95_TARGET_MS}ms target`)
  }

  console.log("\n=== Summary ===")
  console.log(`Security: ${security.length - secFail}/${security.length} passed`)
  if (secFail) console.log("  Fix failing security checks before App Store submission.")
  if (embedLoad.p95 > P95_TARGET_MS) {
    console.log(`  Embedded home p95 (${embedLoad.p95}ms) exceeds ${P95_TARGET_MS}ms — optimize cold/warm paths.`)
  } else {
    console.log(`  Embedded home p95 (${embedLoad.p95}ms) within Shopify guideline.`)
  }

  process.exit(secFail > 0 ? 1 : 0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
