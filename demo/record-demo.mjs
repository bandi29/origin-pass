/**
 * OriginPass 60s reviewer demo — records .webm via Playwright.
 * Follows the approved storyboard: free tier → billing upgrade (simulated
 * approval via tier flip, as the webhook would do) → evidence → print → passport.
 * Run from the OriginPass repo root with the dev server on :3000.
 */
import { chromium } from "@playwright/test"
import { createClient } from "@supabase/supabase-js"
import dotenv from "dotenv"
import { mkdirSync, renameSync } from "node:fs"
import path from "node:path"

dotenv.config({ path: ".env.local" })
const BASE = "http://localhost:3000"
const SHOP = "originpass-sandbox.myshopify.com"
const OUT_DIR = path.resolve("demo")
const pause = (ms) => new Promise((r) => setTimeout(r, ms))
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

async function setTier(tier) {
  await db.from("organizations").update({ subscription_tier: tier }).eq("shop_domain", SHOP)
}

mkdirSync(OUT_DIR, { recursive: true })
await setTier("free") // scene arc starts on the Free plan

const browser = await chromium.launch({ slowMo: 300 })
const context = await browser.newContext({
  // 1440×900: guaranteed single-line control rows + generous card margins.
  viewport: { width: 1440, height: 900 },
  recordVideo: { dir: OUT_DIR, size: { width: 1440, height: 900 } },
})

/**
 * Persistent demo chrome — runs on EVERY navigation, before React hydration, so
 * it can't be clobbered by re-renders:
 *  1. Hides the local-dev banner (#dev-embed-note) via stylesheet.
 *  2. Replaces that space with a branded "OriginPass · Production Sandbox" header.
 */
await context.addInitScript(() => {
  const apply = () => {
    if (document.getElementById("demo-brand-style")) return
    const style = document.createElement("style")
    style.id = "demo-brand-style"
    style.textContent = `
      #dev-embed-note { display: none !important; }
      ui-title-bar { display: none !important; } /* renders raw children outside the admin */
      body { padding-top: 46px !important; }
      #demo-brand-bar {
        position: fixed; inset: 0 0 auto 0; z-index: 9000; height: 46px;
        display: flex; align-items: center; justify-content: space-between;
        padding: 0 20px; background: #ffffff; border-bottom: 1px solid #e3e3e3;
        font-family: -apple-system, "SF Pro Text", sans-serif;
      }
      #demo-brand-bar .brand { display: flex; align-items: center; gap: 10px; }
      #demo-brand-bar .dot { width: 22px; height: 22px; border-radius: 6px; background: #1a1a1a;
        color: #fff; font-size: 11px; font-weight: 700; display: flex; align-items: center; justify-content: center; }
      #demo-brand-bar .name { font-size: 14px; font-weight: 600; color: #202223; letter-spacing: -0.1px; }
      #demo-brand-bar .env { font-size: 11px; font-weight: 600; letter-spacing: 0.4px; text-transform: uppercase;
        color: #0c5132; background: #f0fbf4; border: 1px solid #a6e8c4; border-radius: 999px; padding: 4px 10px; }
    `
    document.head.appendChild(style)
    const bar = document.createElement("div")
    bar.id = "demo-brand-bar"
    bar.innerHTML =
      '<div class="brand"><div class="dot">O</div><span class="name">OriginPass</span></div><span class="env">Production Sandbox</span>'
    document.body.appendChild(bar)
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", apply)
  else apply()
})

const page = await context.newPage()

/** No-op kept for scene compatibility — hiding now handled by addInitScript. */
async function cleanChrome() {}

async function titleCard(title, subtitle, ms) {
  await page.evaluate(
    ([t, s]) => {
      const d = document.createElement("div")
      d.id = "demo-title-card"
      d.style.cssText =
        "position:fixed;inset:0;z-index:99999;background:#1a1a1a;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;font-family:-apple-system,sans-serif;padding:0 80px;text-align:center"
      d.innerHTML = `<div style="color:#fff;font-size:32px;font-weight:700;letter-spacing:-0.5px">${t}</div><div style="color:#9ca3af;font-size:17px;line-height:1.5">${s}</div>`
      document.body.appendChild(d)
    },
    [title, subtitle],
  )
  await pause(ms)
  await page.evaluate(() => document.getElementById("demo-title-card")?.remove())
}

// ── 0:00 Title ────────────────────────────────────────────────────────────────
await page.goto(`${BASE}/api/shopify?shop=${SHOP}`)
await page.getByText("Brand defaults").first().waitFor()
await cleanChrome()
await titleCard("OriginPass", "Digital Product Passports for Shopify · 60-second reviewer demo", 3000)
await pause(1500)

// ── 0:05 Brand defaults + contextual save ────────────────────────────────────
const location = page.getByRole("textbox", { name: "Brand production location" })
await location.click()
await location.fill("")
await location.pressSequentially("Florence, Italy ", { delay: 45 })
await pause(800)
await page.getByRole("button", { name: "Save", exact: true }).click()
await page.getByText("All changes saved").waitFor()
await pause(1200)

// ── 0:14 Free tier: locked evidence → upgrade ────────────────────────────────
const upgradeBtn = page.getByRole("button", { name: "Upgrade to Grower" }).first()
await upgradeBtn.scrollIntoViewIfNeeded()
await pause(1800)
await upgradeBtn.hover()
await pause(900)
await titleCard(
  "Native Shopify Billing",
  "Upgrade opens Shopify's charge-approval page top-level — issued with test: true, so reviewers approve at no cost. The app_subscriptions/update webhook activates the tier.",
  4600,
)
await setTier("grower") // what the approval webhook does
await page.reload()
await page.getByText("Brand defaults").first().waitFor()
await cleanChrome()
await pause(800)

// ── 0:24 Grower: evidence attached + document viewer ─────────────────────────
const viewDoc = page.getByRole("button", { name: "View Document" }).first()
await viewDoc.scrollIntoViewIfNeeded()
await pause(1200)
await viewDoc.click()
await pause(2300)
await page.getByRole("button", { name: "Close document viewer" }).click()
await pause(600)

// ── 0:31 Catalog: search, select, quantities ─────────────────────────────────
const search = page.locator("input[type=search]")
await search.scrollIntoViewIfNeeded()
await search.pressSequentially("snowboard", { delay: 50 })
await pause(1300)
await search.fill("")
await pause(700)
await page.getByRole("button", { name: "Select all" }).click()
await page.locator("#qty-all").fill("2")
await page.getByRole("button", { name: "Apply" }).click()
await pause(900)

// ── 0:40 Print-ready labels ──────────────────────────────────────────────────
await page.locator('button:has-text("Print label sheets")').click()
await page.getByText("Print preview").first().waitFor()
await pause(2400)
await page.getByRole("button", { name: "Thermal Roll (Single 2×2)" }).click()
await pause(1700)
await page.keyboard.press("Escape")
await pause(500)

// ── 0:48 Consumer passport ───────────────────────────────────────────────────
await titleCard("Consumer view", "What shoppers see when they scan the printed QR label", 2400)
await page.goto(`${BASE}/shop/originpass-sandbox/10532433035551`)
await page.getByText("Verification & evidence").waitFor()
await pause(1400)
await page.getByText("Verification & evidence").scrollIntoViewIfNeeded()
await pause(2400)

// ── 0:57 End card ────────────────────────────────────────────────────────────
await titleCard(
  "OriginPass",
  "Audit-ready product passports · Native Billing API · GDPR-compliant webhooks",
  3000,
)

const video = page.video()
await context.close()
const raw = await video.path()
const finalPath = path.join(OUT_DIR, "originpass-shopify-review-demo.webm")
renameSync(raw, finalPath)
await browser.close()
await setTier("free") // restore the storyboard pre-flight state for manual takes
console.log("VIDEO:", finalPath)
