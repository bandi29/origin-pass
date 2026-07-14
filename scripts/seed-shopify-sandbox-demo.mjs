#!/usr/bin/env node
/**
 * Reseed believable compliance demo data for the Shopify sandbox store.
 * Run: npm run shopify:seed-demo
 */
import { readFileSync, existsSync } from "node:fs"
import { resolve } from "node:path"
import { createClient } from "@supabase/supabase-js"

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
    const value = trimmed.slice(eq + 1).trim()
    if (!process.env[key]) process.env[key] = value
  }
}

loadEnvLocal()

const shop = process.env.SHOPIFY_DEV_STORE || "originpass-sandbox.myshopify.com"
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or Supabase key in .env.local")
  process.exit(1)
}

const supabase = createClient(url, key)

const BRAND_DEFAULTS = {
  global_production_location: "Como, Italy",
  global_care_instructions:
    "Wipe with a dry cloth · store away from heat and direct sunlight · do not machine wash",
}

/** Products that should inherit brand defaults (no per-product override). */
const INHERIT_BY_NAME = [/gift card/i, /selling plans ski wax/i]

/** Physical products with believable per-product overrides for demo variety. */
const OVERRIDES_BY_NAME: Array<{ pattern: RegExp; production: string; care: string }> = [
  {
    pattern: /3p fulfilled snowboard/i,
    production: "Guangdong, China",
    care: "Store flat in a cool, dry place · wax base seasonally · avoid prolonged sun exposure",
  },
  {
    pattern: /snowboard/i,
    production: "Guangdong, China",
    care: "Store flat in a cool, dry place · wax base seasonally · avoid prolonged sun exposure",
  },
]

async function main() {
  const { data: org, error: orgErr } = await supabase
    .from("organizations")
    .select("id")
    .eq("shop_domain", shop)
    .maybeSingle()

  if (orgErr || !org?.id) {
    console.error(`Organization not found for ${shop}`)
    process.exit(1)
  }

  const { error: brandErr } = await supabase
    .from("organizations")
    .update(BRAND_DEFAULTS)
    .eq("id", org.id)

  if (brandErr) {
    console.error("Failed to update brand defaults:", brandErr.message)
    process.exit(1)
  }

  const { data: products, error: prodErr } = await supabase
    .from("products")
    .select("id, name, compliance_data")
    .eq("organization_id", org.id)

  if (prodErr) {
    console.error("Failed to load products:", prodErr.message)
    process.exit(1)
  }

  let updated = 0
  for (const product of products ?? []) {
    const name = product.name ?? ""
    let compliance = { ...(product.compliance_data as Record<string, unknown> | null) }

    if (INHERIT_BY_NAME.some((re) => re.test(name))) {
      compliance = {}
    } else {
      const override = OVERRIDES_BY_NAME.find((row) => row.pattern.test(name))
      if (override) {
        compliance = {
          production_location: override.production,
          care_instructions: override.care,
        }
      }
    }

    const { error } = await supabase
      .from("products")
      .update({ compliance_data: compliance })
      .eq("id", product.id)

    if (error) {
      console.warn(`Skip ${name}: ${error.message}`)
      continue
    }
    updated += 1
    console.log(`Updated: ${name}`)
  }

  console.log(`\nDone — brand defaults set and ${updated} product(s) reseeded for ${shop}.`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
