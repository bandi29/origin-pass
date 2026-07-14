#!/usr/bin/env node
/**
 * Diagnose blank Shopify embedded iframe — run while `npm run shopify:dev` is active.
 */
import { execSync } from "node:child_process"

const shop = process.env.SHOPIFY_DEV_STORE || "originpass-sandbox.myshopify.com"
const host =
  process.env.SHOPIFY_EMBED_HOST ||
  "YWRtaW4uc2hvcGlmeS5jb20vc3RvcmUvb3JpZ2lucGFzcy1zYW5kYm94"
const query = `embedded=1&shop=${encodeURIComponent(shop)}&host=${encodeURIComponent(host)}`
const queryShopHostOnly = `shop=${encodeURIComponent(shop)}&host=${encodeURIComponent(host)}`

function curlHead(url) {
  try {
    return execSync(`curl -sI "${url}"`, { encoding: "utf8", timeout: 15000 })
  } catch {
    return ""
  }
}

function curlBody(url) {
  try {
    return execSync(`curl -s "${url}"`, { encoding: "utf8", timeout: 15000, maxBuffer: 5_000_000 })
  } catch {
    return ""
  }
}

function check(label, url) {
  const headers = curlHead(url)
  const body = curlBody(url)
  const ok = headers.includes("200") && body.includes("Store configuration")
  const xfo = headers.match(/x-frame-options:\s*(.+)/i)?.[1]?.trim()
  const csp = headers.match(/content-security-policy:\s*(.+)/i)?.[1]?.trim()
  const rewrite = headers.match(/x-middleware-rewrite:\s*(.+)/i)?.[1]?.trim()
  console.log(`\n[${ok ? "OK" : "FAIL"}] ${label}`)
  console.log(`  URL: ${url}`)
  if (rewrite) console.log(`  Rewrite: ${rewrite}`)
  if (xfo) console.log(`  X-Frame-Options: ${xfo}${xfo.toLowerCase() === "sameorigin" ? " ← blocks Shopify iframe" : ""}`)
  if (csp?.includes("frame-ancestors")) console.log(`  CSP frame-ancestors: set (embed-friendly)`)
  if (!ok) console.log(`  Response missing "Store configuration" — iframe will look blank`)
  return ok
}

/** Shopify CLI listens on a random port (not 3000) and forwards to Next.js. */
function detectShopifyProxyPorts() {
  try {
    const out = execSync("lsof -nP -iTCP -sTCP:LISTEN 2>/dev/null", { encoding: "utf8", timeout: 5000 })
    const ports = new Set()
    for (const line of out.split("\n")) {
      if (!line.startsWith("node")) continue
      const match = line.match(/:(\d+)\s+\(LISTEN\)/)
      if (!match) continue
      const port = Number(match[1])
      if (port === 3000 || port === 3457) continue
      ports.add(port)
    }
    return [...ports]
  } catch {
    return []
  }
}

console.log("OriginPass Shopify embed diagnostics")
console.log(`Dev store: ${shop}`)

const localhostOk = check("Next.js (localhost:3000)", `http://localhost:3000/?${query}`)
const shopHostOk = check(
  "Embed entry without embedded=1 (shop+host only)",
  `http://localhost:3000/?${queryShopHostOnly}`,
)

let proxyOk = false
const proxyPorts = detectShopifyProxyPorts()
for (const port of proxyPorts) {
  if (check(`Shopify CLI proxy (localhost:${port})`, `http://localhost:${port}/?${query}`)) {
    proxyOk = true
    break
  }
}
if (!proxyOk && proxyPorts.length === 0) {
  console.log("\n[WARN] No Shopify CLI proxy port detected — is `npm run shopify:dev` running?")
} else if (!proxyOk) {
  console.log(`\n[WARN] Shopify CLI proxy ports [${proxyPorts.join(", ")}] did not return embedded home content.`)
}

const prodHeaders = curlHead(`https://originpass.com/?${query}`)
const prodBody = curlBody(`https://originpass.com/?${query}`)
const prodOk = prodBody.includes("Store configuration")
console.log(`\n[${prodOk ? "OK" : "FAIL"}] Production host (originpass.com)`)
if (!prodOk) {
  console.log("  originpass.com does NOT serve the Next.js app (Apache placeholder).")
  console.log("  Sidebar loads this URL when shopify app dev is NOT running.")
}

console.log("\n--- Summary ---")
if (!localhostOk) {
  console.log("Next.js is not serving the embedded page. Start: npm run shopify:dev")
  process.exit(1)
}
if (!shopHostOk) {
  console.log("WARN: shop+host without embedded=1 is not rewriting — in-app links may blank the iframe.")
}
if (!prodOk) {
  console.log("For local dev: keep `npm run shopify:dev` running and open the Preview URL from the CLI.")
  console.log("Do NOT rely on the sidebar alone unless Next.js is deployed to originpass.com.")
}
console.log("Local app is healthy. If Shopify admin is still blank, hard-refresh the admin tab after restarting dev.")
