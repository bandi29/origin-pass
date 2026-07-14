#!/usr/bin/env npx tsx
/**
 * Shopify Admin API product seeder — standalone load-test fixture tool.
 *
 * Creates ~2,500 dummy products on the development store so catalog sync
 * exceeds HEAVY_VOLUME_THRESHOLD (2,000) for structural validation.
 *
 * Auth (first match wins):
 *   1. SHOPIFY_ADMIN_ACCESS_TOKEN env (custom app / Admin API token)
 *   2. organizations.shopify_access_token for SHOPIFY_DEV_STORE (via Supabase)
 *
 * Usage:
 *   npx tsx scripts/seedProducts.ts
 *   npx tsx scripts/seedProducts.ts --count 2500
 *   npx tsx scripts/seedProducts.ts --csv scripts/fixtures/seed-products-template.csv
 *   npx tsx scripts/seedProducts.ts --write-template
 *   npx tsx scripts/seedProducts.ts --dry-run
 *
 * Optional env:
 *   SHOPIFY_DEV_STORE=originpass-sandbox.myshopify.com
 *   SHOPIFY_ADMIN_ACCESS_TOKEN=shpat_...
 *   SHOPIFY_API_VERSION=2024-10
 *   SEED_PRODUCT_COUNT=2500
 *   SEED_BATCH_SIZE=5
 *   SEED_DELAY_MS=500
 */

import { createClient } from "@supabase/supabase-js"
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const DEFAULT_COUNT = 2_500
const DEFAULT_BATCH = 5
const DEFAULT_DELAY_MS = 500
const PLACEHOLDER_IMAGES = [
  "https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-product-1_large.png",
  "https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-product-2_large.png",
  "https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-product-3_large.png",
  "https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-product-4_large.png",
  "https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-product-5_large.png",
] as const

const TITLE_PREFIXES = [
  "OriginPass Load",
  "Sandbox Trace",
  "Compliance Sample",
  "Passport Fixture",
  "Heavy Catalog",
] as const

const TITLE_MATERIALS = [
  "Leather Tote",
  "Wool Scarf",
  "Linen Shirt",
  "Denim Jacket",
  "Silk Blouse",
  "Cotton Tee",
  "Canvas Backpack",
  "Merino Socks",
] as const

const TAG_POOL = [
  "load-test",
  "originpass-seed",
  "heavy-volume",
  "sandbox",
  "apparel",
  "accessories",
  "eu-dpp",
  "traceability",
] as const

type CliOptions = {
  count: number
  batchSize: number
  delayMs: number
  csvPath: string | null
  dryRun: boolean
  writeTemplate: boolean
}

type SeedProduct = {
  title: string
  tags: string[]
  imageUrl: string
  sku: string
  bodyHtml: string
}

type CreateResult = {
  ok: boolean
  title: string
  id?: string
  error?: string
  retryAfterMs?: number
}

function loadEnvLocal(): void {
  const envPath = resolve(ROOT, ".env.local")
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

function parseArgs(argv: string[]): CliOptions {
  const opts: CliOptions = {
    count: Number(process.env.SEED_PRODUCT_COUNT || DEFAULT_COUNT),
    batchSize: Number(process.env.SEED_BATCH_SIZE || DEFAULT_BATCH),
    delayMs: Number(process.env.SEED_DELAY_MS || DEFAULT_DELAY_MS),
    csvPath: null,
    dryRun: false,
    writeTemplate: false,
  }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === "--count" && argv[i + 1]) {
      opts.count = Math.max(1, Number(argv[++i]))
    } else if (arg === "--batch" && argv[i + 1]) {
      opts.batchSize = Math.max(1, Number(argv[++i]))
    } else if (arg === "--delay-ms" && argv[i + 1]) {
      opts.delayMs = Math.max(0, Number(argv[++i]))
    } else if (arg === "--csv" && argv[i + 1]) {
      opts.csvPath = resolve(ROOT, argv[++i])
    } else if (arg === "--dry-run") {
      opts.dryRun = true
    } else if (arg === "--write-template") {
      opts.writeTemplate = true
    } else if (arg === "--help" || arg === "-h") {
      printHelp()
      process.exit(0)
    }
  }

  return opts
}

function printHelp(): void {
  console.log(`Shopify product seeder (standalone)

Usage:
  npx tsx scripts/seedProducts.ts [options]

Options:
  --count N           Number of products to create (default ${DEFAULT_COUNT})
  --batch N           Concurrent creates per wave (default ${DEFAULT_BATCH})
  --delay-ms N        Pause between waves (default ${DEFAULT_DELAY_MS})
  --csv PATH          Import titles/tags/images from a CSV instead of generating
  --write-template    Write scripts/fixtures/seed-products-template.csv and exit
  --dry-run           Print planned products without calling Shopify
  -h, --help          Show this help
`)
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms))
}

function isValidShopDomain(shop: string): boolean {
  return /^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/.test(shop)
}

function buildGeneratedProducts(count: number): SeedProduct[] {
  const stamp = Date.now().toString(36)
  const products: SeedProduct[] = []
  for (let i = 1; i <= count; i += 1) {
    const prefix = TITLE_PREFIXES[i % TITLE_PREFIXES.length]
    const material = TITLE_MATERIALS[i % TITLE_MATERIALS.length]
    const imageUrl = PLACEHOLDER_IMAGES[i % PLACEHOLDER_IMAGES.length]
    const tags = [
      TAG_POOL[i % TAG_POOL.length],
      TAG_POOL[(i + 3) % TAG_POOL.length],
      i % 2 === 0 ? "even-batch" : "odd-batch",
      `seed-${stamp}`,
    ]
    products.push({
      title: `${prefix} ${material} #${String(i).padStart(4, "0")}`,
      tags,
      imageUrl,
      sku: `OP-SEED-${stamp}-${String(i).padStart(4, "0")}`,
      bodyHtml: `<p>OriginPass load-test fixture ${i}. Tags: ${tags.join(", ")}.</p>`,
    })
  }
  return products
}

/** Minimal CSV: title,tags,image_url,sku (header required). tags are semicolon-separated. */
function parseCsvProducts(csvPath: string): SeedProduct[] {
  const raw = readFileSync(csvPath, "utf8")
  const lines = raw.split(/\r?\n/).filter((line) => line.trim().length > 0)
  if (lines.length < 2) {
    throw new Error(`CSV ${csvPath} needs a header row and at least one data row`)
  }

  const header = lines[0].split(",").map((h) => h.trim().toLowerCase())
  const titleIdx = header.indexOf("title")
  const tagsIdx = header.indexOf("tags")
  const imageIdx = header.indexOf("image_url")
  const skuIdx = header.indexOf("sku")
  if (titleIdx < 0) throw new Error("CSV must include a title column")

  const products: SeedProduct[] = []
  for (let row = 1; row < lines.length; row += 1) {
    const cols = splitCsvLine(lines[row])
    const title = (cols[titleIdx] ?? "").trim()
    if (!title) continue
    const tagsRaw = tagsIdx >= 0 ? cols[tagsIdx] ?? "" : "load-test;originpass-seed"
    const tags = tagsRaw
      .split(/[;|]/)
      .map((t) => t.trim())
      .filter(Boolean)
    const imageUrl =
      (imageIdx >= 0 ? cols[imageIdx]?.trim() : "") ||
      PLACEHOLDER_IMAGES[row % PLACEHOLDER_IMAGES.length]
    const sku =
      (skuIdx >= 0 ? cols[skuIdx]?.trim() : "") || `OP-CSV-${String(row).padStart(4, "0")}`
    products.push({
      title,
      tags: tags.length ? tags : ["load-test"],
      imageUrl,
      sku,
      bodyHtml: `<p>CSV-imported OriginPass fixture: ${title}</p>`,
    })
  }
  return products
}

function splitCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ""
  let inQuotes = false
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"'
        i += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }
    if (ch === "," && !inQuotes) {
      out.push(cur)
      cur = ""
      continue
    }
    cur += ch
  }
  out.push(cur)
  return out
}

function writeCsvTemplate(): string {
  const outDir = resolve(ROOT, "scripts/fixtures")
  mkdirSync(outDir, { recursive: true })
  const outPath = resolve(outDir, "seed-products-template.csv")
  const sample = buildGeneratedProducts(5)
  const rows = [
    "title,tags,image_url,sku",
    ...sample.map((p) =>
      [
        csvEscape(p.title),
        csvEscape(p.tags.join(";")),
        csvEscape(p.imageUrl),
        csvEscape(p.sku),
      ].join(","),
    ),
  ]
  writeFileSync(outPath, `${rows.join("\n")}\n`, "utf8")
  return outPath
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

async function resolveAccessToken(shop: string): Promise<string> {
  const fromEnv = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN?.trim()
  if (fromEnv) return fromEnv

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error(
      "Set SHOPIFY_ADMIN_ACCESS_TOKEN, or provide NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY so the seeder can read organizations.shopify_access_token.",
    )
  }

  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data, error } = await supabase
    .from("organizations")
    .select("shopify_access_token")
    .eq("shop_domain", shop)
    .maybeSingle()

  if (error) throw new Error(`Supabase lookup failed: ${error.message}`)
  const token = (data as { shopify_access_token?: string | null } | null)?.shopify_access_token
  if (!token) {
    throw new Error(
      `No shopify_access_token for ${shop}. Open the embedded app once (Connect store) or set SHOPIFY_ADMIN_ACCESS_TOKEN.`,
    )
  }
  return token
}

/**
 * REST Admin API product create — single call with title, tags, variant SKU,
 * and placeholder image. More reliable for bulk seeding than GraphQL productCreate
 * across API version churn.
 */
async function createProduct(
  shop: string,
  token: string,
  apiVersion: string,
  product: SeedProduct,
): Promise<CreateResult> {
  const res = await fetch(`https://${shop}/admin/api/${apiVersion}/products.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": token,
      Accept: "application/json",
    },
    body: JSON.stringify({
      product: {
        title: product.title,
        body_html: product.bodyHtml,
        vendor: "OriginPass Seed",
        product_type: "Load Test Fixture",
        tags: product.tags.join(", "),
        status: "active",
        images: [{ src: product.imageUrl }],
        variants: [
          {
            sku: product.sku,
            price: "19.99",
            inventory_management: null,
          },
        ],
      },
    }),
  })

  if (res.status === 429) {
    const retryAfterSec = Number(res.headers.get("Retry-After") || "2")
    return {
      ok: false,
      title: product.title,
      error: "rate limited (429)",
      retryAfterMs: Math.max(1, retryAfterSec) * 1000,
    }
  }

  if (!res.ok) {
    const text = await res.text()
    return {
      ok: false,
      title: product.title,
      error: `HTTP ${res.status}: ${text.slice(0, 240)}`,
    }
  }

  const json = (await res.json()) as { product?: { id?: number | string; title?: string } }
  const id = json.product?.id != null ? String(json.product.id) : undefined
  if (!id) {
    return { ok: false, title: product.title, error: "No product id in response" }
  }

  return { ok: true, title: product.title, id }
}

async function main(): Promise<void> {
  loadEnvLocal()
  const opts = parseArgs(process.argv.slice(2))

  if (opts.writeTemplate) {
    const path = writeCsvTemplate()
    console.log(`Wrote CSV template: ${path}`)
    return
  }

  const shop = (process.env.SHOPIFY_DEV_STORE || "originpass-sandbox.myshopify.com").trim()
  if (!isValidShopDomain(shop)) {
    console.error(`Invalid SHOPIFY_DEV_STORE: ${shop}`)
    process.exit(1)
  }

  const apiVersion = process.env.SHOPIFY_API_VERSION || "2024-10"
  const products = opts.csvPath
    ? parseCsvProducts(opts.csvPath)
    : buildGeneratedProducts(opts.count)

  console.log("OriginPass Shopify product seeder")
  console.log(`  shop:        ${shop}`)
  console.log(`  apiVersion:  ${apiVersion}`)
  console.log(`  products:    ${products.length}`)
  console.log(`  batchSize:   ${opts.batchSize}`)
  console.log(`  delayMs:     ${opts.delayMs}`)
  console.log(`  source:      ${opts.csvPath ? opts.csvPath : "generated"}`)
  console.log(`  dryRun:      ${opts.dryRun}`)
  console.log("")

  if (opts.dryRun) {
    console.log("Sample titles:")
    for (const p of products.slice(0, 5)) {
      console.log(`  - ${p.title} [${p.tags.join(", ")}]`)
    }
    if (products.length > 5) console.log(`  … and ${products.length - 5} more`)
    return
  }

  const token = await resolveAccessToken(shop)
  let created = 0
  let failed = 0

  for (let i = 0; i < products.length; i += opts.batchSize) {
    const wave = products.slice(i, i + opts.batchSize)
    const results = await Promise.all(
      wave.map((product) => createProduct(shop, token, apiVersion, product)),
    )

    let extraDelay = 0
    for (const result of results) {
      if (result.ok) {
        created += 1
      } else {
        failed += 1
        console.warn(`  FAIL ${result.title}: ${result.error}`)
        if (result.retryAfterMs) extraDelay = Math.max(extraDelay, result.retryAfterMs)
      }
    }

    const done = Math.min(i + opts.batchSize, products.length)
    console.log(`  progress ${done}/${products.length} (ok=${created} fail=${failed})`)

    const pause = Math.max(opts.delayMs, extraDelay)
    if (done < products.length && pause > 0) await sleep(pause)
  }

  console.log("")
  console.log(`Done. created=${created} failed=${failed}`)
  console.log(
    "Next: open the embedded app and run a full catalog sync so OriginPass imports past HEAVY_VOLUME_THRESHOLD (2000).",
  )
  if (failed > 0) process.exit(1)
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
