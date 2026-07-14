/**
 * k6 load test — public passport detail route
 *
 * Targets the consumer passport page under concurrent load and asserts
 * Shopify App Store–oriented performance gates:
 *   - http_req_duration p95 < 500ms
 *   - http_req_failed rate < 1%
 *
 * Default path shape matches `/p/[product_id]` (QR / passport token route).
 * For Shopify storefront passports use PATH_TEMPLATE=/sp/{shop}/{id} instead.
 *
 * Prerequisites:
 *   brew install k6   # or https://k6.io/docs/get-started/installation/
 *
 * Usage:
 *   k6 run tests/load/passportLoad.js
 *
 *   BASE_URL=https://your-host.example \
 *   PASSPORT_IDS=token-a,token-b,token-c \
 *   k6 run tests/load/passportLoad.js
 *
 *   # Shopify public passport short URLs:
 *   BASE_URL=http://localhost:3000 \
 *   PATH_TEMPLATE=/sp/originpass-sandbox/{id} \
 *   PASSPORT_IDS=1234567890,9876543210 \
 *   k6 run tests/load/passportLoad.js
 *
 * Env:
 *   BASE_URL          Origin under test (default http://localhost:3000)
 *   PASSPORT_IDS      Comma-separated product/passport ids or QR tokens
 *   PATH_TEMPLATE     Path with `{id}` placeholder (default /p/{id})
 *   THINK_TIME_MS     Optional pause between iterations (default 0)
 */

import http from "k6/http"
import { check, sleep } from "k6"
import { Rate, Trend } from "k6/metrics"

const BASE_URL = (__ENV.BASE_URL || "http://localhost:3000").replace(/\/$/, "")
const PATH_TEMPLATE = __ENV.PATH_TEMPLATE || "/p/{id}"
const THINK_TIME_MS = Number(__ENV.THINK_TIME_MS || 0)

const DEFAULT_IDS = ["load-test-passport-1", "load-test-passport-2", "load-test-passport-3"]
const PASSPORT_IDS = (__ENV.PASSPORT_IDS || DEFAULT_IDS.join(","))
  .split(",")
  .map((id) => id.trim())
  .filter(Boolean)

if (PASSPORT_IDS.length === 0) {
  throw new Error("PASSPORT_IDS must contain at least one id/token")
}

const passportErrorRate = new Rate("passport_http_errors")
const passportDuration = new Trend("passport_req_duration", true)

export const options = {
  scenarios: {
    passport_public_ramp: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        // Ramp 0 → 50 over 2 minutes
        { duration: "2m", target: 50 },
        // Sustain 50 VUs for 3 minutes
        { duration: "3m", target: 50 },
        // Ramp down to 0
        { duration: "1m", target: 0 },
      ],
      gracefulRampDown: "30s",
    },
  },
  thresholds: {
    // Shopify embedded / public surface guideline: p95 under 500ms
    http_req_duration: ["p(95)<500"],
    // Strictly less than 1% HTTP errors (4xx/5xx + network failures)
    http_req_failed: ["rate<0.01"],
    // Named passport metric mirrors the same gate for clearer reports
    passport_req_duration: ["p(95)<500"],
    passport_http_errors: ["rate<0.01"],
  },
  summaryTrendStats: ["avg", "med", "p(90)", "p(95)", "p(99)", "max"],
}

function buildUrl(id) {
  const path = PATH_TEMPLATE.replaceAll("{id}", encodeURIComponent(id))
  return `${BASE_URL}${path.startsWith("/") ? path : `/${path}`}`
}

export function setup() {
  const probeId = PASSPORT_IDS[0]
  const probeUrl = buildUrl(probeId)
  const res = http.get(probeUrl, {
    headers: { Accept: "text/html,application/xhtml+xml" },
    tags: { name: "setup_probe" },
  })

  console.log(`k6 passport load — BASE_URL=${BASE_URL}`)
  console.log(`PATH_TEMPLATE=${PATH_TEMPLATE}`)
  console.log(`PASSPORT_IDS count=${PASSPORT_IDS.length}`)
  console.log(`setup probe ${probeUrl} → HTTP ${res.status}`)

  return {
    ids: PASSPORT_IDS,
    baseUrl: BASE_URL,
  }
}

export default function (data) {
  const ids = data.ids
  const id = ids[Math.floor(Math.random() * ids.length)]
  const url = buildUrl(id)

  const res = http.get(url, {
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "User-Agent": "OriginPass-k6-passportLoad/1.0",
    },
    tags: { name: "passport_detail" },
  })

  passportDuration.add(res.timings.duration)

  const ok = check(res, {
    "status is 200 or 404 (known fixture miss still counts as handled)": (r) =>
      r.status === 200 || r.status === 404,
    "status is not 5xx": (r) => r.status < 500,
    "body is non-empty": (r) => (r.body || "").length > 0,
  })

  // Treat 5xx / empty / transport failure as errors for the custom rate.
  // 404 is allowed so missing seed tokens do not falsely fail the suite;
  // set only real passport tokens in PASSPORT_IDS for production gates.
  const isError = res.status >= 500 || res.status === 0 || !ok
  passportErrorRate.add(isError)

  if (THINK_TIME_MS > 0) {
    sleep(THINK_TIME_MS / 1000)
  }
}

export function handleSummary(data) {
  const p95 = data.metrics.http_req_duration?.values["p(95)"]
  const failRate = data.metrics.http_req_failed?.values.rate
  const lines = [
    "",
    "=== OriginPass passport load summary ===",
    `p95 http_req_duration: ${p95 != null ? `${p95.toFixed(1)}ms` : "n/a"} (gate < 500ms)`,
    `http_req_failed rate:  ${failRate != null ? `${(failRate * 100).toFixed(3)}%` : "n/a"} (gate < 1%)`,
    "",
  ]
  return {
    stdout: lines.join("\n"),
  }
}
