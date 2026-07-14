/**
 * Ensures the supplier-certificates Supabase Storage bucket exists (public-readable).
 * Loads .env.local and uses SUPABASE_SERVICE_ROLE_KEY.
 */
import { readFileSync, existsSync } from "node:fs"
import { resolve } from "node:path"
import { createClient } from "@supabase/supabase-js"

const ROOT = resolve(import.meta.dirname, "..")
const envPath = resolve(ROOT, ".env.local")
const BUCKET = "supplier-certificates"

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

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local")
  process.exit(1)
}

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const { data: buckets, error: listError } = await admin.storage.listBuckets()
if (listError) {
  console.error("listBuckets failed:", listError.message)
  process.exit(1)
}

if (buckets?.some((b) => b.name === BUCKET)) {
  console.log(`OK: bucket "${BUCKET}" already exists`)
  process.exit(0)
}

const { error: createError } = await admin.storage.createBucket(BUCKET, {
  public: true,
  fileSizeLimit: 5 * 1024 * 1024,
  allowedMimeTypes: ["application/pdf", "image/png", "image/jpeg", "image/jpg"],
})

if (createError && !createError.message?.includes("already exists")) {
  console.error("createBucket failed:", createError.message)
  process.exit(1)
}

console.log(`Created public bucket "${BUCKET}"`)
