/**
 * OriginPass Shopify App Store demo (≈4–8 min) — Playwright video.
 *
 * Scope: Shopify embedded admin ONLY (no marketing site / web portal).
 * Storyboard:
 *  1. Fresh install → onboarding checklist → Sync Store Products
 *  2. Store configuration (hook, catalog, brand defaults, evidence/billing)
 *  3. Product Edit — why override, attach evidence, save
 *  4. Print labels — Avery + Thermal (grid preview, not endless column)
 *
 * Run: npm run demo:record  (dev server on :3000)
 * Output: demo/originpass-app-store-demo.webm + .mp4
 */
import { chromium } from "@playwright/test"
import { createClient } from "@supabase/supabase-js"
import dotenv from "dotenv"
import { mkdirSync, renameSync, existsSync, copyFileSync } from "node:fs"
import { spawnSync } from "node:child_process"
import path from "node:path"

dotenv.config({ path: ".env.local" })

const BASE = process.env.DEMO_BASE_URL || "http://localhost:3000"
const SHOP = "originpass-sandbox.myshopify.com"
const HOME = `${BASE}/api/shopify?shop=${SHOP}&storyboard=fresh`
const OUT_DIR = path.resolve("demo")
const OUT_WEBM = path.join(OUT_DIR, "originpass-app-store-demo.webm")
const OUT_MP4 = path.join(OUT_DIR, "originpass-app-store-demo.mp4")
const VIEWPORT = { width: 1600, height: 900 }
const pause = (ms) => new Promise((r) => setTimeout(r, ms))

const hasDb = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
const db = hasDb
  ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  : null

async function setTier(tier) {
  if (!db) return
  const { error } = await db.from("organizations").update({ subscription_tier: tier }).eq("shop_domain", SHOP)
  if (error) console.warn("setTier:", error.message)
}

function findFfmpeg() {
  const which = spawnSync("which", ["ffmpeg"], { encoding: "utf8" })
  if (which.status === 0 && which.stdout.trim()) return which.stdout.trim()
  for (const candidate of ["/opt/homebrew/bin/ffmpeg", "/usr/local/bin/ffmpeg"]) {
    if (existsSync(candidate)) return candidate
  }
  return null
}

mkdirSync(OUT_DIR, { recursive: true })
await setTier("free")

const browser = await chromium.launch({ headless: true, slowMo: 180 })
const context = await browser.newContext({
  viewport: VIEWPORT,
  deviceScaleFactor: 1,
  recordVideo: { dir: OUT_DIR, size: VIEWPORT },
})

await context.addInitScript(() => {
  const apply = () => {
    if (document.getElementById("demo-brand-style")) return
    const style = document.createElement("style")
    style.id = "demo-brand-style"
    style.textContent = `
      #dev-embed-note { display: none !important; }
      ui-title-bar { display: none !important; }
      /* Next.js DevTools / "1 Issue" pill — local-dev only, not part of OriginPass UI */
      nextjs-portal,
      [data-next-badge-root],
      [data-nextjs-toast],
      .nextjs-toast-errors-parent { display: none !important; visibility: hidden !important; }
      body { padding-top: 46px !important; background: #f6f6f7 !important; }
      #demo-brand-bar {
        position: fixed; inset: 0 0 auto 0; z-index: 9000; height: 46px;
        display: flex; align-items: center; justify-content: space-between;
        padding: 0 20px; background: #ffffff; border-bottom: 1px solid #e3e3e3;
        font-family: -apple-system, "SF Pro Text", sans-serif;
      }
      #demo-brand-bar .brand { display: flex; align-items: center; gap: 10px; }
      #demo-brand-bar .dot {
        width: 22px; height: 22px; border-radius: 6px; background: #1a1a1a;
        color: #fff; font-size: 11px; font-weight: 700; display: flex; align-items: center; justify-content: center;
      }
      #demo-brand-bar .name { font-size: 14px; font-weight: 600; color: #202223; }
      #demo-brand-bar .env {
        font-size: 11px; font-weight: 600; letter-spacing: 0.4px; text-transform: uppercase;
        color: #0c5132; background: #f0fbf4; border: 1px solid #a6e8c4; border-radius: 999px; padding: 4px 10px;
      }
    `
    document.head.appendChild(style)
    const bar = document.createElement("div")
    bar.id = "demo-brand-bar"
    bar.innerHTML =
      '<div class="brand"><div class="dot">O</div><span class="name">OriginPass · Shopify Admin</span></div><span class="env">Embedded App Demo</span>'
    document.body.prepend(bar)
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", apply)
  else apply()
  // Next DevTools can inject after hydration — keep stripping it for clean demos.
  const mo = new MutationObserver(() => {
    document.querySelectorAll("nextjs-portal, [data-next-badge-root], [data-nextjs-toast]").forEach((el) => {
      el.style.setProperty("display", "none", "important")
    })
  })
  mo.observe(document.documentElement, { childList: true, subtree: true })
})

const page = await context.newPage()

/** Full-screen chapter — intro/outro only (keep short). */
async function chapterCard(title, subtitle, ms = 4000) {
  await page.evaluate(
    ([t, s]) => {
      document.getElementById("demo-title-card")?.remove()
      document.getElementById("demo-narrate")?.remove()
      const d = document.createElement("div")
      d.id = "demo-title-card"
      d.style.cssText =
        "position:fixed;inset:0;z-index:99999;background:#0f172a;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;font-family:-apple-system,BlinkMacSystemFont,sans-serif;padding:0 100px;text-align:center"
      d.innerHTML = `<div style="color:#94a3b8;font-size:12px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase">OriginPass · Shopify embedded app</div><div style="color:#fff;font-size:32px;font-weight:700;letter-spacing:-0.5px;line-height:1.2">${t}</div><div style="color:#94a3b8;font-size:16px;line-height:1.5;max-width:760px">${s}</div>`
      document.body.appendChild(d)
    },
    [title, subtitle],
  )
  await pause(Math.min(ms, 5000))
  await page.evaluate(() => document.getElementById("demo-title-card")?.remove())
}

/**
 * In-app narration banner — app UI stays visible underneath.
 * Prefer this for every mid-demo explanation so the video is not a slideshow of dark slides.
 */
async function narrate(title, subtitle, ms = 2800) {
  await page.evaluate(
    ([t, s]) => {
      document.getElementById("demo-title-card")?.remove()
      document.getElementById("demo-narrate")?.remove()
      const d = document.createElement("div")
      d.id = "demo-narrate"
      d.style.cssText =
        "position:fixed;left:16px;right:16px;bottom:16px;z-index:99998;background:rgba(15,23,42,0.94);color:#fff;border-radius:12px;padding:14px 18px;font-family:-apple-system,BlinkMacSystemFont,sans-serif;box-shadow:0 8px 30px rgba(0,0,0,0.25);pointer-events:none"
      d.innerHTML = `<div style="font-size:11px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:#94a3b8;margin-bottom:4px">OriginPass</div><div style="font-size:16px;font-weight:700;line-height:1.25">${t}</div><div style="margin-top:4px;font-size:13px;line-height:1.45;color:#cbd5e1">${s}</div>`
      document.body.appendChild(d)
    },
    [title, subtitle],
  )
  await pause(Math.min(ms, 3500))
  await page.evaluate(() => document.getElementById("demo-narrate")?.remove())
}

// Back-compat alias used by older steps — maps to narrate (not full-screen).
async function titleCard(title, subtitle, ms = 2800) {
  await narrate(title, subtitle, ms)
}

async function safeStep(label, fn) {
  try {
    console.log("→", label)
    await fn()
  } catch (err) {
    console.warn("⚠ skip", label, String(err?.message || err).slice(0, 220))
    await narrate("Continuing", `${label} — skipped; moving to the next feature.`, 2200)
  }
}

async function scrollBy(px, wait = 1000) {
  await page.mouse.wheel(0, px)
  await pause(wait)
}

async function openHome() {
  await page.goto(HOME, { waitUntil: "domcontentloaded", timeout: 60000 })
  await page.getByText(/Store configuration|Brand defaults|Sync Your Catalog|Sync Store Products/i).first().waitFor({ timeout: 45000 })
  await pause(2200)
}

// ═══════════════════════════════════════════════════════════════════════════
await safeStep("intro", async () => {
  await openHome()
  await chapterCard(
    "Merchant demo inside Shopify",
    "Install → sync → brand defaults & evidence → edit products → print QR labels. All inside Shopify Admin.",
    4500,
  )
})

await safeStep("store configuration overview", async () => {
  await titleCard(
    "1 · Store configuration",
    "Home screen after install: connection status (Hook active), catalog link state, brand-wide defaults, evidence, and print controls — one place to run the app.",
    9500,
  )
  await openHome()
  await page.getByText("Store configuration").first().scrollIntoViewIfNeeded()
  await pause(2500)
  // Highlight status chips
  await page.getByText(/Hook active|Catalog linked|originpass-sandbox/i).first().scrollIntoViewIfNeeded().catch(() => {})
  await pause(3000)
  await scrollBy(220, 1400)
})

await safeStep("fresh install onboarding + sync", async () => {
  await titleCard(
    "2 · First-time setup",
    "On first open the catalog is empty. Sync Store Products imports Shopify SKUs into OriginPass so each product can receive a digital passport and QR label.",
    9500,
  )
  await page.getByText(/Sync Your Catalog|Sync Store Products|Assign Brand Defaults|Proceed to sync|Import products/i).first().scrollIntoViewIfNeeded()
  await pause(2500)

  const syncBtn = page
    .getByRole("button", { name: /Sync Store Products|Proceed to sync/i })
    .first()
  await syncBtn.waitFor({ timeout: 15000 })
  await syncBtn.click()
  await pause(2500)
  // Wait for sync UI to settle / catalog to appear
  await page
    .getByText(/Print-ready|Select all|Showing|Compliance health|Brand defaults|Last synced/i)
    .first()
    .waitFor({ timeout: 90000 })
    .catch(() => {})
  await pause(2500)
  await scrollBy(280, 1200)
})

await safeStep("brand defaults", async () => {
  await titleCard(
    "3 · Brand defaults",
    "Set production location and care once at store level. Every passport inherits these values until a single product overrides them.",
    7000,
  )
  await page.locator("#brand-defaults-section").scrollIntoViewIfNeeded()
  await pause(2200)

  const location = page.getByRole("textbox", { name: /Brand production location/i })
  await location.click()
  await location.fill("")
  await location.pressSequentially("Florence, Italy", { delay: 45 })
  await pause(1800)

  const care = page.getByRole("textbox", { name: /Brand care instructions/i })
  await care.click()
  await care.fill("")
  await care.pressSequentially("Hand wash cold. Lay flat to dry. Do not bleach.", { delay: 35 })
  await pause(2200)

  const saveBtn = page.getByRole("button", { name: "Save", exact: true })
  if (await saveBtn.isEnabled().catch(() => false)) {
    await saveBtn.click()
    await page.getByText(/All changes saved|Saved/i).first().waitFor({ timeout: 12000 }).catch(() => {})
  }
  await pause(2500)
})

await safeStep("billing + brand evidence", async () => {
  await titleCard(
    "4 · Evidence & Grower plan",
    "Free plan shows the upgrade path. Grower unlocks supplier PDF/JPG evidence on brand defaults so passports become audit-ready.",
    7000,
  )
  const upgrade = page.getByRole("button", { name: /Upgrade to Grower/i }).first()
  if (await upgrade.isVisible().catch(() => false)) {
    await upgrade.scrollIntoViewIfNeeded()
    await pause(2200)
    await upgrade.hover()
    await pause(1800)
  }

  await setTier("grower")
  await page.reload({ waitUntil: "domcontentloaded" })
  // After reload, storyboard=fresh would hide catalog again — keep unlocked path:
  // navigate without fresh so catalog stays, OR with fresh and sync again.
  await page.goto(`${BASE}/api/shopify?shop=${SHOP}`, { waitUntil: "domcontentloaded", timeout: 60000 })
  await page.getByText(/Brand defaults|Store configuration/i).first().waitFor({ timeout: 45000 })
  await pause(2500)

  await page.locator("#brand-defaults-section").scrollIntoViewIfNeeded()
  await pause(2200)

  const attach = page.getByRole("button", { name: /Attach verifying document/i }).first()
  const viewDoc = page.getByRole("button", { name: /View Document/i }).first()
  if (await viewDoc.isVisible().catch(() => false)) {
    await viewDoc.scrollIntoViewIfNeeded()
    await pause(2200)
    await viewDoc.click()
    await pause(2800)
    await page.getByRole("button", { name: /Close document viewer|Close/i }).first().click().catch(() => {})
    await pause(1000)
  } else if (await attach.isVisible().catch(() => false)) {
    await attach.scrollIntoViewIfNeeded()
    await pause(3000)
  } else {
    await pause(2500)
  }
})

await safeStep("compliance health + review", async () => {
  await titleCard(
    "5 · Compliance health",
    "This scoreboard counts audit-ready passports. “Awaiting evidence” means claims exist without verifying documents. Review incomplete filters the catalog so you only work on those SKUs.",
    9500,
  )

  await page.goto(`${BASE}/api/shopify?shop=${SHOP}`, { waitUntil: "domcontentloaded", timeout: 60000 })
  await page.getByText(/Compliance health|Brand defaults|Store configuration/i).first().waitFor({ timeout: 45000 })
  await pause(2200)

  const health = page.locator("#compliance-health-section")
  await health.scrollIntoViewIfNeeded()
  await pause(2200)

  const reviewBtn = page.getByRole("button", { name: /Review incomplete/i })
  if (await reviewBtn.isVisible().catch(() => false)) {
    await reviewBtn.click()
    await pause(2000)
    await page.locator("#catalog-section").waitFor({ timeout: 10000 })
    await page.getByText(/Showing .* incomplete|click Edit to attach evidence/i).first().waitFor({ timeout: 10000 })
    await pause(2500)

    await titleCard(
      "Review → Edit → attach evidence",
      "Each filtered row still needs proof. Open Edit, attach a verifying document (or inherit brand evidence), Save, then return. Clear filter when finished.",
      7500,
    )

    const editLink = page.locator('#catalog-section a[href*="/api/shopify/products/"]').first()
    if (await editLink.isVisible().catch(() => false)) {
      const href = await editLink.getAttribute("href")
      await page.goto(`${BASE}${href}`, { waitUntil: "domcontentloaded", timeout: 60000 })
      await page.getByText(/Production location|Back to store configuration/i).first().waitFor({ timeout: 30000 })
      await pause(2800)

      await page.getByText(/Production location|Care instructions|Attach verifying|View Document|Inherited/i).first().scrollIntoViewIfNeeded()
      await pause(2800)

      const attach = page.getByRole("button", { name: /Attach verifying document/i }).first()
      if (await attach.isVisible().catch(() => false)) {
        await attach.scrollIntoViewIfNeeded()
        await pause(2000)
      }
      const viewDoc = page.getByRole("button", { name: /View Document/i }).first()
      if (await viewDoc.isVisible().catch(() => false)) {
        await viewDoc.scrollIntoViewIfNeeded()
        await pause(1500)
        await viewDoc.click()
        await pause(2200)
        await page.getByRole("button", { name: /Close document viewer|Close/i }).first().click().catch(() => {})
      }

      await page.getByRole("link", { name: /Back to store configuration/i }).click()
      await page.getByText(/Compliance health|Brand defaults/i).first().waitFor({ timeout: 30000 })
      await pause(2200)
    }

    // Re-enable filter if lost on navigation, then clear it
    const reviewAgain = page.getByRole("button", { name: /Review incomplete/i })
    if (await reviewAgain.isVisible().catch(() => false)) {
      await reviewAgain.click()
      await pause(1500)
    }
    const clear = page.getByRole("button", { name: /Show all products|Clear filter/i }).first()
    if (await clear.isVisible().catch(() => false)) {
      await clear.click()
      await pause(3000)
    }
  } else {
    await pause(2000)
  }
})

await safeStep("catalog selection", async () => {
  await titleCard(
    "6 · Catalog & quantities",
    "Search synced products, select rows, set how many QR stickers each SKU needs, then open print preview.",
    6500,
  )
  await page.getByText(/Print-ready label|Select all|Showing/i).first().scrollIntoViewIfNeeded().catch(() => {})
  await pause(2200)

  const search = page.locator('input[type=search]').first()
  if (await search.isVisible().catch(() => false)) {
    await search.click()
    await search.fill("")
    await search.pressSequentially("shirt", { delay: 60 })
    await pause(2200)
    await search.fill("")
    await pause(1800)
  }

  // Select only a few products (better print preview) — click first 2 checkboxes if present
  const selectAll = page.getByRole("button", { name: /Select all/i })
  if (await selectAll.isVisible().catch(() => false)) {
    // Clear if already all selected, then pick individually via row checkboxes
    const label = await selectAll.innerText()
    if (/Clear all/i.test(label)) await selectAll.click()
    await pause(600)
  }

  const checkboxes = page.locator('input[type=checkbox]')
  const count = await checkboxes.count()
  for (let i = 0; i < Math.min(2, count); i++) {
    const box = checkboxes.nth(i)
    if (!(await box.isChecked().catch(() => false))) await box.check().catch(() => {})
    await pause(400)
  }
  // Fallback: select all if no checkboxes worked
  if (count === 0 && (await selectAll.isVisible().catch(() => false))) {
    await selectAll.click()
  }

  const qty = page.locator("#qty-all")
  if (await qty.isVisible().catch(() => false)) {
    await qty.fill("1")
    await page.getByRole("button", { name: /^Apply$/i }).click().catch(() => {})
  }
  await pause(2800)
})

await safeStep("edit product passport", async () => {
  await titleCard(
    "7 · Why Edit a product?",
    "Use Edit when one SKU differs from brand defaults — different origin, care rules, or product-specific certificates. Overrides keep the rest of the catalog on shared defaults.",
    8000,
  )

  const editLink = page.locator('a[href*="/api/shopify/products/"]').first()
  await editLink.waitFor({ timeout: 20000 })
  await editLink.scrollIntoViewIfNeeded()
  await pause(1800)
  const href = await editLink.getAttribute("href")
  await page.goto(`${BASE}${href}`, { waitUntil: "domcontentloaded", timeout: 60000 })
  await page.getByText(/Production location|Back to store configuration/i).first().waitFor({ timeout: 30000 })
  await pause(2500)

  await titleCard(
    "Product passport editor",
    "Review inherited brand values, override a field, attach verifying documents, then Save product — Contextual Save keeps changes intentional.",
    6500,
  )

  await page.getByText(/Production location/i).first().scrollIntoViewIfNeeded()
  await pause(2800)

  const override = page.getByRole("button", { name: /Override for this product/i }).first()
  if (await override.isVisible().catch(() => false)) {
    await override.click()
    await pause(2200)
    const prodInput = page.locator("#productProductionLocation")
    if (await prodInput.isVisible().catch(() => false)) {
      await prodInput.fill("")
      await prodInput.pressSequentially("Prato, Italy", { delay: 45 })
      await pause(1800)
    }

    // Evidence / upload affordances after override
    const attach = page.getByRole("button", { name: /Attach verifying document/i }).first()
    if (await attach.isVisible().catch(() => false)) {
      await attach.scrollIntoViewIfNeeded()
      await pause(2800)
    }
    const viewDoc = page.getByRole("button", { name: /View Document/i }).first()
    if (await viewDoc.isVisible().catch(() => false)) {
      await viewDoc.scrollIntoViewIfNeeded()
      await pause(2200)
      await viewDoc.click()
      await pause(2500)
      await page.getByRole("button", { name: /Close document viewer|Close/i }).first().click().catch(() => {})
    }

    // Revert to keep sandbox clean
    const revert = page.getByRole("button", { name: /Revert|Use brand default|brand default/i }).first()
    if (await revert.isVisible().catch(() => false)) {
      await revert.click()
      await pause(1800)
    }
  }

  await scrollBy(300, 1200)
  await page.getByText(/Care instructions/i).first().scrollIntoViewIfNeeded().catch(() => {})
  await pause(2200)

  const saveProduct = page.getByRole("button", { name: /Save product|Save/i }).first()
  if (await saveProduct.isVisible().catch(() => false)) {
    await saveProduct.scrollIntoViewIfNeeded()
    await pause(2800)
  }

  await page.getByRole("link", { name: /Back to store configuration/i }).click()
  await page.getByText(/Brand defaults|Store configuration/i).first().waitFor({ timeout: 30000 })
  await pause(2200)
})

await safeStep("print Avery", async () => {
  await titleCard(
    "8 · Print labels · Avery sheet",
    "Avery 5160 prints 30 QR labels per US Letter sheet — ideal for packing slips and batch stickering.",
    6500,
  )

  // Ensure selection
  const selectAll = page.getByRole("button", { name: /Select all|Clear all/i })
  if (await selectAll.isVisible().catch(() => false)) {
    const t = await selectAll.innerText()
    if (/Select all/i.test(t)) await selectAll.click()
  }
  // Prefer Avery format on home controls
  const averyHome = page.getByRole("button", { name: /Avery Sheet/i }).first()
  if (await averyHome.isVisible().catch(() => false)) await averyHome.click()

  const printBtn = page.locator('button:has-text("Print label sheets")').first()
  await printBtn.scrollIntoViewIfNeeded()
  await pause(1000)
  await printBtn.click()
  await page.getByText(/Print preview/i).first().waitFor({ timeout: 20000 })
  await pause(2800)

  // Format toggle lives in the print overlay group (not the home page control).
  const formatGroup = page.getByRole("group", { name: "Label format" })
  await formatGroup.getByRole("button", { name: /Avery 5160/i }).click()
  await pause(2800)
})

await safeStep("print Thermal", async () => {
  await titleCard(
    "Thermal roll · 2×2",
    "Thermal mode previews stickers in a readable grid on screen. Printing still outputs one 2×2 label per roll slice — not an endless single column.",
    9500,
  )

  const formatGroup = page.getByRole("group", { name: "Label format" })
  await formatGroup.getByRole("button", { name: /Thermal Roll/i }).click()
  await pause(3000)
  await page.getByText(/grid preview|thermal stickers|Print preview · Thermal/i).first().waitFor({ timeout: 10000 }).catch(() => {})
  await scrollBy(200, 1500)
  await pause(2500)

  await page.getByRole("button", { name: /Back to Catalog/i }).click()
  await pause(2800)
})

await safeStep("closing", async () => {
  await chapterCard(
    "OriginPass in Shopify",
    "Sync → brand defaults & evidence → Review incomplete → Edit → Print Avery or Thermal labels.",
    4500,
  )
})

const video = page.video()
await context.close()
const raw = await video.path()
if (existsSync(OUT_WEBM)) {
  try {
    renameSync(OUT_WEBM, path.join(OUT_DIR, `originpass-app-store-demo.prev-${Date.now()}.webm`))
  } catch {
    /* ignore */
  }
}
renameSync(raw, OUT_WEBM)
await browser.close()
await setTier("free")

console.log("VIDEO_WEBM:", OUT_WEBM)

const ffmpegPath = findFfmpeg()
if (ffmpegPath) {
  const r = spawnSync(
    ffmpegPath,
    ["-y", "-i", OUT_WEBM, "-c:v", "libx264", "-pix_fmt", "yuv420p", "-movflags", "+faststart", OUT_MP4],
    { encoding: "utf8" },
  )
  if (r.status === 0) console.log("VIDEO_MP4:", OUT_MP4)
  else console.warn("ffmpeg failed:", (r.stderr || "").slice(0, 400))
} else {
  copyFileSync(OUT_WEBM, path.join(OUT_DIR, "originpass-app-store-demo-copy.webm"))
  console.log("No ffmpeg — use the .webm or install ffmpeg")
}
console.log("DONE")
