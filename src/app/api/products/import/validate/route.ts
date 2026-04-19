import type { ColumnMapping } from "@/lib/import-products/types"
import { REQUIRED_IMPORT_FIELDS } from "@/lib/import-products/types"
import { isMappingComplete } from "@/lib/import-products/mapping"
import { loadExistingSkuSet, validateMappedRowsFromJobFile } from "@/lib/import-products/validate-job-file"
import { createClient } from "@/lib/supabase/server"
import { ensureBrandProfile } from "@/lib/tenancy"

export const runtime = "nodejs"

type Body = {
  sessionId?: string
  mapping?: ColumnMapping
}

const MAX_ERRORS_RETURNED = 500

export async function POST(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  await ensureBrandProfile(supabase, user)

  let body: Body
  try {
    body = (await req.json()) as Body
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const sessionId = body.sessionId?.trim()
  const mapping = body.mapping
  if (!sessionId || !mapping) {
    return Response.json({ error: "sessionId and mapping are required" }, { status: 400 })
  }

  const { data: job, error: jobErr } = await supabase
    .from("import_jobs")
    .select("id, file_url, file_name")
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .maybeSingle()

  if (!jobErr && job?.file_url) {
    const complete = isMappingComplete(mapping, REQUIRED_IMPORT_FIELDS)
    if (!complete.ok) {
      return Response.json({
        ok: false,
        mappingIncomplete: true,
        missingFields: complete.missing,
        totalRows: 0,
        validRows: 0,
        failedRows: 0,
        errors: [],
        mappedPreview: [],
      })
    }

    const existingSkus = await loadExistingSkuSet(user.id)
    const result = await validateMappedRowsFromJobFile(job.file_url, job.file_name, mapping, existingSkus)

    return Response.json({
      ok: result.failedRows === 0,
      totalRows: result.totalRows,
      validRows: result.validRows,
      failedRows: result.failedRows,
      errors: result.errors.slice(0, MAX_ERRORS_RETURNED),
      mappedPreview: result.mappedPreview,
      mappingIncomplete: false,
    })
  }

  const { data: session, error: sesErr } = await supabase
    .from("product_import_sessions")
    .select("id, user_id, rows_json")
    .eq("id", sessionId)
    .eq("user_id", user.id)
    .maybeSingle()

  if (sesErr || !session) {
    return Response.json({ error: "Session or job not found. Upload again." }, { status: 404 })
  }

  const rows = session.rows_json as Record<string, string>[]
  if (!Array.isArray(rows)) {
    return Response.json({ error: "Invalid session data" }, { status: 400 })
  }

  const complete = isMappingComplete(mapping, REQUIRED_IMPORT_FIELDS)
  if (!complete.ok) {
    return Response.json({
      ok: false,
      mappingIncomplete: true,
      missingFields: complete.missing,
      totalRows: rows.length,
      validRows: 0,
      failedRows: rows.length,
      errors: [],
      mappedPreview: [],
    })
  }

  const { data: existing } = await supabase.from("products").select("sku").eq("brand_id", user.id)

  const existingSkus = new Set<string>()
  for (const p of existing ?? []) {
    const s = p.sku
    if (typeof s === "string" && s.trim()) existingSkus.add(s.trim().toLowerCase())
  }

  const { validateMappedRows } = await import("@/lib/import-products/validate")
  const result = validateMappedRows(rows, mapping, existingSkus, { allowExistingSkus: false })

  return Response.json({
    ok: result.failedRows === 0,
    ...result,
    errors: result.errors.slice(0, MAX_ERRORS_RETURNED),
    mappingIncomplete: false,
  })
}
