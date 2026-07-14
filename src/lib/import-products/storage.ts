/**
 * Storage abstraction for uploaded CSV/XLSX import files.
 *
 * - On serverless platforms (Vercel, Lambda), the local filesystem is ephemeral and
 *   not shared between request invocations. Files written during /upload would not
 *   be visible to /validate or to background workers running in another process.
 * - This module uploads files to Supabase Storage in production and falls back to
 *   the local filesystem in development. Downstream consumers receive a "storage
 *   reference" string which can be materialised to a local temp file when needed.
 *
 * Reference format:
 *   - Supabase Storage: `supabase://<bucket>/<objectPath>`
 *   - Local filesystem: absolute path beginning with `/`
 */
import { mkdir, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { randomUUID } from "node:crypto"

import { createAdminClient } from "@/lib/supabase/admin"
import { ensureImportDir, getImportFileAbsolutePath } from "@/lib/import-products/storage-paths"

const SUPABASE_BUCKET = process.env.IMPORT_STORAGE_BUCKET || "import-uploads"
const SUPABASE_PREFIX = "supabase://"
const IMPORT_MAX_SIZE_MB = 50
const IMPORT_ALLOWED_MIME_TYPES = [
  "text/csv",
  "text/plain",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]

async function ensureImportBucketExists(): Promise<void> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return

  const admin = createAdminClient()
  const { data: buckets, error: listError } = await admin.storage.listBuckets()
  if (listError) {
    console.error("import-uploads bucket list error:", listError)
    return
  }

  const exists = buckets?.some((bucket) => bucket.name === SUPABASE_BUCKET)
  if (exists) return

  const { error } = await admin.storage.createBucket(SUPABASE_BUCKET, {
    public: false,
    fileSizeLimit: IMPORT_MAX_SIZE_MB * 1024 * 1024,
    allowedMimeTypes: IMPORT_ALLOWED_MIME_TYPES,
  })
  if (error && !error.message?.includes("already exists")) {
    throw new Error(`Failed to create import-uploads bucket: ${error.message}`)
  }
}

function useSupabaseStorage(): boolean {
  if (process.env.IMPORT_USE_SUPABASE_STORAGE === "true") return true
  if (process.env.IMPORT_USE_SUPABASE_STORAGE === "false") return false
  return process.env.NODE_ENV === "production"
}

function importExt(fileName: string): string {
  const lower = fileName.toLowerCase()
  if (lower.endsWith(".xlsx")) return ".xlsx"
  return ".csv"
}

function isSupabaseRef(ref: string): boolean {
  return ref.startsWith(SUPABASE_PREFIX)
}

function parseSupabaseRef(ref: string): { bucket: string; objectPath: string } {
  const stripped = ref.slice(SUPABASE_PREFIX.length)
  const slash = stripped.indexOf("/")
  if (slash < 0) {
    throw new Error(`Invalid Supabase Storage reference: ${ref}`)
  }
  return { bucket: stripped.slice(0, slash), objectPath: stripped.slice(slash + 1) }
}

export async function uploadImportFile(params: {
  userId: string
  jobId: string
  fileName: string
  buffer: Buffer
}): Promise<string> {
  const ext = importExt(params.fileName)

  if (useSupabaseStorage()) {
    await ensureImportBucketExists()
    const objectPath = `${params.userId}/${params.jobId}${ext}`
    const admin = createAdminClient()
    const { error } = await admin.storage
      .from(SUPABASE_BUCKET)
      .upload(objectPath, params.buffer, {
        upsert: true,
        contentType: ext === ".xlsx"
          ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          : "text/csv",
      })
    if (error) throw new Error(`Supabase Storage upload failed: ${error.message}`)
    return `${SUPABASE_PREFIX}${SUPABASE_BUCKET}/${objectPath}`
  }

  await ensureImportDir(params.userId)
  const absPath = getImportFileAbsolutePath(params.userId, params.jobId, params.fileName)
  await writeFile(absPath, params.buffer)
  return absPath
}

export async function importFileExists(ref: string): Promise<boolean> {
  if (isSupabaseRef(ref)) {
    const { bucket, objectPath } = parseSupabaseRef(ref)
    const admin = createAdminClient()
    const lastSlash = objectPath.lastIndexOf("/")
    const dir = lastSlash >= 0 ? objectPath.slice(0, lastSlash) : ""
    const name = lastSlash >= 0 ? objectPath.slice(lastSlash + 1) : objectPath
    const { data, error } = await admin.storage.from(bucket).list(dir, { search: name, limit: 1 })
    if (error) return false
    return Boolean(data?.some((entry) => entry.name === name))
  }
  try {
    const { stat } = await import("node:fs/promises")
    await stat(ref)
    return true
  } catch {
    return false
  }
}

export async function readImportFileBuffer(ref: string): Promise<Buffer> {
  if (isSupabaseRef(ref)) {
    const { bucket, objectPath } = parseSupabaseRef(ref)
    const admin = createAdminClient()
    const { data, error } = await admin.storage.from(bucket).download(objectPath)
    if (error || !data) throw new Error(`Supabase Storage download failed: ${error?.message ?? "missing"}`)
    return Buffer.from(await data.arrayBuffer())
  }
  return readFile(ref)
}

/**
 * Ensures the file is available as a local path for streaming consumers
 * (csv-parse, xlsx). For Supabase Storage refs, downloads to a temp file
 * and returns the local path; the caller MUST call `cleanupMaterialised`.
 * For local refs, returns the path unchanged with cleanup = noop.
 */
export async function materialiseImportFileToLocal(ref: string, fileName: string): Promise<{
  localPath: string
  cleanup: () => Promise<void>
}> {
  if (!isSupabaseRef(ref)) {
    return { localPath: ref, cleanup: async () => {} }
  }
  const ext = importExt(fileName)
  const dir = path.join(tmpdir(), "originpass-import")
  await mkdir(dir, { recursive: true })
  const localPath = path.join(dir, `${randomUUID()}${ext}`)
  const buf = await readImportFileBuffer(ref)
  await writeFile(localPath, buf)
  return {
    localPath,
    cleanup: async () => {
      try {
        await rm(localPath, { force: true })
      } catch {
        // best-effort
      }
    },
  }
}
