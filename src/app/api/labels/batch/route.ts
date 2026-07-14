import { createClient } from "@/lib/supabase/server"
import { normalizePrinter, resolvePersistedTemplateId } from "@/lib/labels/service"

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const body = (await request.json().catch(() => ({}))) as {
    templateId?: string
    templateName?: string
    csvRows?: number
    printerType?: string
    exportFormat?: string
  }
  const quantity = Math.max(1, Number(body.csvRows ?? 1))
  const templateId = resolvePersistedTemplateId(body.templateId)
  const templateKey = body.templateId?.trim() && !templateId ? body.templateId.trim() : null

  const { data, error } = await supabase
    .from("label_print_jobs")
    .insert({
      brand_id: user.id,
      template_id: templateId,
      quantity,
      printer_type: normalizePrinter(body.printerType),
      status: "queued",
      export_format: (body.exportFormat ?? "zip").toLowerCase(),
      created_by: user.id,
      metadata_json: {
        source: "csv_batch",
        template_key: templateKey,
        template_name: body.templateName?.trim() || null,
      },
    })
    .select("*")
    .single()

  if (error) return Response.json({ error: error.message }, { status: 400 })
  return Response.json({ queuedJob: data })
}
