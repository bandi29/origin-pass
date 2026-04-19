import { createHash } from "node:crypto"
import { writeFile } from "node:fs/promises"

import { randomUUID } from "node:crypto"
import { guessMapping } from "@/lib/import-products/mapping"
import { MAX_ASYNC_FILE_BYTES, previewRows } from "@/lib/import-products/parse-file"
import { analyzeCsvFile, analyzeXlsxBuffer } from "@/lib/import-products/stream-sheet"
import { checkRateLimit } from "@/lib/import-products/rate-limit"
import { ensureImportDir, getImportFileAbsolutePath } from "@/lib/import-products/storage-paths"
import { createClient } from "@/lib/supabase/server"
import { getOrganizationIdForUser } from "@/lib/passport-wizard-product"
import { ensureBrandProfile } from "@/lib/tenancy"

export const runtime = "nodejs"

const WINDOW_MS = 60 * 60 * 1000
const MAX_UPLOADS = 40

export async function POST(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const rl = checkRateLimit(`import-upload:${user.id}`, MAX_UPLOADS, WINDOW_MS)
  if (!rl.ok) {
    return Response.json(
      { error: "Too many uploads. Try again later.", retryAfterMs: rl.retryAfterMs },
      { status: 429 },
    )
  }

  await ensureBrandProfile(supabase, user)

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return Response.json({ error: "Invalid form data" }, { status: 400 })
  }

  const file = form.get("file")
  if (!(file instanceof File)) {
    return Response.json({ error: "Missing file field" }, { status: 400 })
  }

  const buf = Buffer.from(await file.arrayBuffer())
  if (buf.length === 0) {
    return Response.json({ error: "File is empty." }, { status: 400 })
  }
  if (buf.length > MAX_ASYNC_FILE_BYTES) {
    return Response.json(
      { error: `Maximum file size is ${Math.round(MAX_ASYNC_FILE_BYTES / (1024 * 1024))}MB for imports.` },
      { status: 400 },
    )
  }

  const lower = file.name.toLowerCase()
  if (!lower.endsWith(".csv") && !lower.endsWith(".xlsx")) {
    return Response.json({ error: "Only .csv and .xlsx files are supported." }, { status: 400 })
  }

  const contentHash = createHash("sha256").update(buf).digest("hex")

  const { data: dup } = await supabase
    .from("import_jobs")
    .select("id")
    .eq("user_id", user.id)
    .eq("content_hash", contentHash)
    .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .maybeSingle()

  if (dup?.id) {
    return Response.json(
      {
        error: "This file was already uploaded in the last 24 hours. Use the existing import or wait before re-uploading.",
        duplicateJobId: dup.id,
      },
      { status: 409 },
    )
  }

  const jobId = randomUUID()
  await ensureImportDir(user.id)
  const absPath = getImportFileAbsolutePath(user.id, jobId, file.name)
  await writeFile(absPath, buf)

  const meta =
    lower.endsWith(".csv") ? await analyzeCsvFile(absPath, file.name) : analyzeXlsxBuffer(file.name, buf)

  if ("error" in meta) {
    return Response.json({ error: meta.error }, { status: 400 })
  }

  const organizationId = await getOrganizationIdForUser(user.id)

  const { error: insErr } = await supabase.from("import_jobs").insert({
    id: jobId,
    user_id: user.id,
    brand_id: user.id,
    organization_id: organizationId,
    file_url: absPath,
    file_name: file.name,
    content_hash: contentHash,
    status: "UPLOADED",
    total_rows: meta.totalRows,
    mapping: {},
  })

  if (insErr) {
    console.error("import_jobs insert:", insErr)
    return Response.json(
      { error: "Could not create import job. Ensure migrations are applied (import_jobs)." },
      { status: 500 },
    )
  }

  const suggestedMapping = guessMapping(meta.headers)

  return Response.json({
    sessionId: jobId,
    jobId,
    fileName: file.name,
    headers: meta.headers,
    totalRows: meta.totalRows,
    preview: previewRows(meta.preview),
    suggestedMapping,
  })
}
