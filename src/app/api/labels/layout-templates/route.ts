import { createClient } from "@/lib/supabase/server"
import {
  duplicateNameUserMessage,
  isDuplicateNameError,
  trimTemplateDescription,
  trimTemplateName,
  validateLayoutSnapshot,
} from "@/lib/labels/layout-template-validation"
import type { CreateLayoutTemplateInput } from "@/lib/labels/layout-template-types"

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const { data, error } = await supabase
    .from("label_layout_templates")
    .select("*")
    .eq("brand_id", user.id)
    .order("updated_at", { ascending: false })

  if (error) return Response.json({ error: error.message }, { status: 400 })
  return Response.json({ templates: data ?? [] })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const body = (await request.json().catch(() => ({}))) as Partial<CreateLayoutTemplateInput>
  const name = trimTemplateName(body.name)
  if (!name) {
    return Response.json({ error: "Template name is required" }, { status: 400 })
  }

  const layoutResult = validateLayoutSnapshot(body.layout)
  if ("error" in layoutResult) {
    return Response.json({ error: layoutResult.error }, { status: 400 })
  }

  const description = trimTemplateDescription(body.description)
  const cols = Math.max(1, Math.floor(Number(body.cols ?? layoutResult.cols ?? 1)))
  const rows = Math.max(1, Math.floor(Number(body.rows ?? layoutResult.rows ?? 1)))
  const doubleSided = Boolean(body.doubleSided ?? layoutResult.doubleSided)
  const dimensions =
    typeof body.dimensions === "string" && body.dimensions.trim()
      ? body.dimensions.trim().slice(0, 80)
      : layoutResult.dimensions

  const { data, error } = await supabase
    .from("label_layout_templates")
    .insert({
      brand_id: user.id,
      created_by: user.id,
      name,
      description,
      layout: layoutResult,
      dimensions,
      cols,
      rows,
      double_sided: doubleSided,
    })
    .select("*")
    .single()

  if (error) {
    if (isDuplicateNameError(error.message)) {
      return Response.json({ error: duplicateNameUserMessage() }, { status: 409 })
    }
    return Response.json({ error: error.message }, { status: 400 })
  }

  return Response.json({ template: data })
}
