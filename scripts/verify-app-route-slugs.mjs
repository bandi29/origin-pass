#!/usr/bin/env node
/**
 * Guard the /s vs /sp Shopify QR route layout that previously crashed Next.js:
 *   /s/[passportId]  — UUID passport redirect (legacy)
 *   /sp/[shopSlug]/[productId] — short Shopify public passport QR
 */
import fs from "node:fs"
import path from "node:path"

const appDir = path.join(process.cwd(), "src/app")
const sDir = path.join(appDir, "s")

if (!fs.existsSync(sDir)) {
  console.log("No /s routes — skip.")
  process.exit(0)
}

const topLevel = fs.readdirSync(sDir, { withFileTypes: true }).filter((e) => e.isDirectory())
const singleDynamic = topLevel
  .map((e) => e.name)
  .filter((name) => /^(\[\.\.\.[^\]]+\]|\[\[?\.\.\.[^\]]+\]\]?|\[[^\].]+\])$/.test(name))
  .filter((name) => !name.includes("..."))

if (singleDynamic.length > 1) {
  console.error(
    `/s has conflicting dynamic routes: ${singleDynamic.join(", ")}. ` +
      "Use /sp/[shopSlug]/[productId] for Shopify QR — not /s/[shopSlug].",
  )
  process.exit(1)
}

const shopUnderS = topLevel.some((e) => e.name === "[shopSlug]" || e.name === "[productId]")
if (shopUnderS) {
  console.error("Shopify QR routes must live under /sp/, not /s/ (conflicts with /s/[passportId]).")
  process.exit(1)
}

const spPage = path.join(appDir, "sp/[shopSlug]/[productId]/page.tsx")
if (!fs.existsSync(spPage)) {
  console.error("Missing src/app/sp/[shopSlug]/[productId]/page.tsx")
  process.exit(1)
}

console.log("Shopify /s vs /sp route check passed.")
