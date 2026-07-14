import { createClient } from "@/lib/supabase/server"
import { defaultSerializedFields, normalizePrinter, sanitizeDimensions } from "@/lib/labels/service"

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const body = (await request.json().catch(() => ({}))) as {
    name?: string
    category?: string
    templateType?: string
    dimensions?: string
    printerCompatibility?: string[]
  }
  if (!body.name?.trim()) {
    return Response.json({ error: "Template name is required" }, { status: 400 })
  }

  const payload = {
    brand_id: user.id,
    name: body.name.trim(),
    category: body.category?.trim() || "Custom",
    template_type: body.templateType?.trim() || "custom",
    dimensions: sanitizeDimensions(body.dimensions),
    printer_compatibility: (body.printerCompatibility ?? ["PDF standard"]).map((p) => normalizePrinter(p)),
    serialized_fields: defaultSerializedFields(),
    is_system: false,
  }

  const { data, error } = await supabase.from("label_templates").insert(payload).select("*").single()
  if (error) return Response.json({ error: error.message }, { status: 400 })
  return Response.json({ template: data })
}
