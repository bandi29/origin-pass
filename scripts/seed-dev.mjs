#!/usr/bin/env node
/**
 * Seed Dev Supabase fixtures for automated tests.
 *
 * GS1-01: product + active passport with a Mod-10-valid GTIN so
 * `GET /01/{gtin}` -> 307 -> `/sp/{shopSlug}/{external_product_id}`.
 *
 * Run: npm run seed:dev
 */
import { readFileSync, existsSync } from "node:fs"
import { resolve } from "node:path"
import { createClient } from "@supabase/supabase-js"
import { randomUUID } from "node:crypto"

const ROOT = resolve(import.meta.dirname, "..")
const envPath = resolve(ROOT, ".env.local")

function loadEnvLocal() {
  if (!existsSync(envPath)) return
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const eq = trimmed.indexOf("=")
    if (eq < 0) continue
    const key = trimmed.slice(0, eq).trim()
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "")
    if (!process.env[key]) process.env[key] = value
  }
}

loadEnvLocal()

/** Requested `00810012345678` fails Mod-10 (check digit should be 5). */
export const GS1_E2E_GTIN = "00810012345675"
/** Public Shopify product id segment + passport_uid for this fixture. */
export const GS1_E2E_PASSPORT_ID = "passport-e2e-gs1-01"
export const GS1_E2E_SHOP = process.env.SHOPIFY_DEV_STORE || "originpass-sandbox.myshopify.com"
export const GS1_E2E_SHOP_SLUG = GS1_E2E_SHOP.replace(/\.myshopify\.com$/i, "")
export const GS1_E2E_LOCATION_PATH = `/sp/${GS1_E2E_SHOP_SLUG}/${GS1_E2E_PASSPORT_ID}`

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local")
  process.exit(1)
}

if (!String(url).includes("jmecvwpgfprmlvteiwkh")) {
  console.error(
    "[seed-dev] Refusing to seed: NEXT_PUBLIC_SUPABASE_URL is not the Dev project (originpass-dev).",
  )
  process.exit(1)
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
})

async function seedGs1E2eProduct() {
  const { data: org, error: orgErr } = await supabase
    .from("organizations")
    .select("id, shop_domain")
    .eq("shop_domain", GS1_E2E_SHOP)
    .maybeSingle()

  if (orgErr || !org?.id) {
    throw new Error(`Organization not found for ${GS1_E2E_SHOP}: ${orgErr?.message ?? "missing"}`)
  }

  const productPayload = {
    organization_id: org.id,
    name: "GS1 E2E Digital Link Fixture",
    sku: "E2E-GS1-01",
    gtin: GS1_E2E_GTIN,
    external_product_id: GS1_E2E_PASSPORT_ID,
    is_archived: false,
    materials: "100% Organic Cotton",
    story: "Seeded fixture for GS1-01 Digital Link e2e verification.",
    origin_country: "Portugal",
    compliance_data: {
      production_location: "Porto, Portugal",
      care_instructions: "Machine wash cold   line dry",
    },
  }

  const { data: existing } = await supabase
    .from("products")
    .select("id")
    .eq("organization_id", org.id)
    .eq("external_product_id", GS1_E2E_PASSPORT_ID)
    .maybeSingle()

  let productId = existing?.id
  if (productId) {
    const { error } = await supabase.from("products").update(productPayload).eq("id", productId)
    if (error) throw new Error(`product update failed: ${error.message}`)
  } else {
    productId = randomUUID()
    const { error } = await supabase.from("products").insert({ id: productId, ...productPayload })
    if (error) throw new Error(`product insert failed: ${error.message}`)
  }

  const serial = `E2E-GS1-${GS1_E2E_GTIN.slice(-6)}`
  const { data: existingPassport } = await supabase
    .from("passports")
    .select("id")
    .eq("organization_id", org.id)
    .eq("passport_uid", GS1_E2E_PASSPORT_ID)
    .maybeSingle()

  const passportPayload = {
    organization_id: org.id,
    product_id: productId,
    passport_uid: GS1_E2E_PASSPORT_ID,
    serial_number: serial,
    status: "active",
    origin_country: "PT",
  }

  if (existingPassport?.id) {
    const { error } = await supabase
      .from("passports")
      .update(passportPayload)
      .eq("id", existingPassport.id)
    if (error) throw new Error(`passport update failed: ${error.message}`)
  } else {
    const { error } = await supabase.from("passports").insert(passportPayload)
    if (error) {
      // serial unique collision - update by serial instead
      const { error: bySerial } = await supabase
        .from("passports")
        .update(passportPayload)
        .eq("serial_number", serial)
      if (bySerial) throw new Error(`passport insert failed: ${error.message}`)
    }
  }

  return {
    organizationId: org.id,
    productId,
    gtin: GS1_E2E_GTIN,
    locationPath: GS1_E2E_LOCATION_PATH,
  }
}

async function main() {
  const result = await seedGs1E2eProduct()
  console.log("[seed-dev] GS1-01 fixture ready:")
  console.log(`  shop:     ${GS1_E2E_SHOP}`)
  console.log(`  gtin:     ${result.gtin}`)
  console.log(`  product:  ${result.productId}`)
  console.log(`  passport: ${GS1_E2E_PASSPORT_ID} (active)`)
  console.log(`  expect:   GET /01/${result.gtin} -> 307 -> ${result.locationPath}`)
}

main().catch((err) => {
  console.error("[seed-dev] failed:", err instanceof Error ? err.message : err)
  process.exit(1)
})
