import { createHash, randomUUID } from "node:crypto"

import { guessMapping } from "@/lib/import-products/mapping"
import { MAX_ASYNC_FILE_BYTES, NUMBERS_EXPORT_HINT, previewRows } from "@/lib/import-products/parse-file"
import { analyzeCsvFile, analyzeXlsxBuffer } from "@/lib/import-products/stream-sheet"
import { checkRateLimit } from "@/lib/import-products/rate-limit"
import {
  importFileExists,
  materialiseImportFileToLocal,
  readImportFileBuffer,
  uploadImportFile,
} from "@/lib/import-products/storage"
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
  if (lower.endsWith(".numbers")) {
    return Response.json({ error: NUMBERS_EXPORT_HINT }, { status: 400 })
  }
  if (!lower.endsWith(".csv") && !lower.endsWith(".xlsx")) {
    return Response.json(
      {
        error:
          "Only .csv and .xlsx files are supported. Apple Numbers users: File → Export To → CSV or Excel, then upload the exported file.",
      },
      { status: 400 },
    )
  }

  const contentHash = createHash("sha256").update(buf).digest("hex")

  const { data: dup } = await supabase
    .from("import_jobs")
    .select("id, file_url, file_name, status")
    .eq("user_id", user.id)
    .eq("content_hash", contentHash)
    .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .maybeSingle()

  if (dup?.id && dup.file_url && dup.file_name) {
    const fileRef: string = dup.file_url
    if (!(await importFileExists(fileRef))) {
      return Response.json(
        {
          error:
            "This catalog was uploaded recently but the staged file is no longer available. Add or remove a row and export again, or wait 24 hours to upload the same file.",
        },
        { status: 409 },
      )
    }
    const prevName = dup.file_name
    const prevLower = prevName.toLowerCase()
    let meta: Awaited<ReturnType<typeof analyzeCsvFile>>
    if (prevLower.endsWith(".csv")) {
      const materialised = await materialiseImportFileToLocal(fileRef, prevName)
      try {
        meta = await analyzeCsvFile(materialised.localPath, prevName)
      } finally {
        await materialised.cleanup()
      }
    } else {
      meta = analyzeXlsxBuffer(prevName, await readImportFileBuffer(fileRef))
    }
    if ("error" in meta) {
      return Response.json({ error: meta.error }, { status: 400 })
    }

    // Reusing the same file (content hash) returns the existing job row. If that run already
    // finished, /import/start would reject with COMPLETED — blocking re-import after undo or
    // a deliberate second pass. Reset the job to UPLOADED so this upload counts as a new run.
    if (dup.status === "COMPLETED") {
      await supabase.from("import_errors").delete().eq("job_id", dup.id)
      const resetNow = new Date().toISOString()
      const { error: resetErr } = await supabase
        .from("import_jobs")
        .update({
          status: "UPLOADED",
          mapping: {},
          success_count: 0,
          failure_count: 0,
          processed_rows: 0,
          last_error: null,
          product_import_log_id: null,
          total_rows: meta.totalRows,
          updated_at: resetNow,
        })
        .eq("id", dup.id)
        .eq("user_id", user.id)

      if (resetErr) {
        console.error("import_jobs reset after COMPLETED (duplicate upload):", resetErr)
        return Response.json(
          { error: "Could not prepare this catalog for another import. Try again in a moment." },
          { status: 500 },
        )
      }
    }

    const suggestedMapping = guessMapping(meta.headers)
    return Response.json({
      sessionId: dup.id,
      jobId: dup.id,
      fileName: prevName,
      headers: meta.headers,
      totalRows: meta.totalRows,
      preview: previewRows(meta.preview),
      suggestedMapping,
      resumed: true,
    })
  }

  const jobId = randomUUID()
  const fileRef = await uploadImportFile({ userId: user.id, jobId, fileName: file.name, buffer: buf })

  let meta: Awaited<ReturnType<typeof analyzeCsvFile>>
  if (lower.endsWith(".csv")) {
    const materialised = await materialiseImportFileToLocal(fileRef, file.name)
    try {
      meta = await analyzeCsvFile(materialised.localPath, file.name)
    } finally {
      await materialised.cleanup()
    }
  } else {
    meta = analyzeXlsxBuffer(file.name, buf)
  }

  if ("error" in meta) {
    return Response.json({ error: meta.error }, { status: 400 })
  }

  const organizationId = await getOrganizationIdForUser(user.id)

  const { error: insErr } = await supabase.from("import_jobs").insert({
    id: jobId,
    user_id: user.id,
    brand_id: user.id,
    organization_id: organizationId,
    file_url: fileRef,
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
