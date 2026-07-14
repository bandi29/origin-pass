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
    quantity?: number
    printerType?: string
    exportFormat?: string
    batchIds?: string[]
    productIds?: string[]
    layoutMode?: string
    action?: "export" | "print"
  }
  const quantity = Math.max(1, Number(body.quantity ?? 1))
  const highVolume = quantity >= 12
  const templateId = resolvePersistedTemplateId(body.templateId)
  const templateKey = body.templateId?.trim() && !templateId ? body.templateId.trim() : null

  const { data, error } = await supabase
    .from("label_print_jobs")
    .insert({
      brand_id: user.id,
      template_id: templateId,
      quantity,
      printer_type: normalizePrinter(body.printerType),
      status: highVolume ? "queued" : "processing",
      export_format: (body.exportFormat ?? "pdf").toLowerCase(),
      created_by: user.id,
      metadata_json: {
        batch_ids: body.batchIds ?? [],
        product_ids: body.productIds ?? [],
        layout_mode: body.layoutMode ?? "sheet",
        action: body.action ?? "export",
        template_key: templateKey,
        template_name: body.templateName?.trim() || null,
      },
    })
    .select("*")
    .single()

  if (error) return Response.json({ error: error.message }, { status: 400 })
  return Response.json({ job: data })
}
