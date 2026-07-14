import { createClient } from "@/lib/supabase/server"
import {
  duplicateNameUserMessage,
  isDuplicateNameError,
  trimTemplateDescription,
  trimTemplateName,
  validateLayoutSnapshot,
} from "@/lib/labels/layout-template-validation"
import type { UpdateLayoutTemplateInput } from "@/lib/labels/layout-template-types"

type RouteContext = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, context: RouteContext) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await context.params
  if (!id?.trim()) return Response.json({ error: "Template id is required" }, { status: 400 })

  const body = (await request.json().catch(() => ({}))) as UpdateLayoutTemplateInput
  const patch: Record<string, unknown> = {}

  if (body.name !== undefined) {
    const name = trimTemplateName(body.name)
    if (!name) return Response.json({ error: "Template name is required" }, { status: 400 })
    patch.name = name
  }

  if (body.description !== undefined) {
    patch.description = trimTemplateDescription(body.description)
  }

  if (body.layout !== undefined) {
    const layoutResult = validateLayoutSnapshot(body.layout)
    if ("error" in layoutResult) {
      return Response.json({ error: layoutResult.error }, { status: 400 })
    }
    patch.layout = layoutResult
    if (body.dimensions === undefined) patch.dimensions = layoutResult.dimensions
    if (body.cols === undefined) patch.cols = layoutResult.cols
    if (body.rows === undefined) patch.rows = layoutResult.rows
    if (body.doubleSided === undefined) patch.double_sided = layoutResult.doubleSided
  }

  if (body.dimensions !== undefined) {
    patch.dimensions =
      typeof body.dimensions === "string" && body.dimensions.trim()
        ? body.dimensions.trim().slice(0, 80)
        : "Custom"
  }
  if (body.cols !== undefined) patch.cols = Math.max(1, Math.floor(Number(body.cols)))
  if (body.rows !== undefined) patch.rows = Math.max(1, Math.floor(Number(body.rows)))
  if (body.doubleSided !== undefined) patch.double_sided = Boolean(body.doubleSided)

  if (Object.keys(patch).length === 0) {
    return Response.json({ error: "No updates provided" }, { status: 400 })
  }

  const { data, error } = await supabase
    .from("label_layout_templates")
    .update(patch)
    .eq("id", id)
    .eq("brand_id", user.id)
    .select("*")
    .single()

  if (error) {
    if (isDuplicateNameError(error.message)) {
      return Response.json({ error: duplicateNameUserMessage() }, { status: 409 })
    }
    return Response.json({ error: error.message }, { status: 400 })
  }

  if (!data) return Response.json({ error: "Template not found" }, { status: 404 })
  return Response.json({ template: data })
}

export async function DELETE(_request: Request, context: RouteContext) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await context.params
  if (!id?.trim()) return Response.json({ error: "Template id is required" }, { status: 400 })

  const { error, count } = await supabase
    .from("label_layout_templates")
    .delete({ count: "exact" })
    .eq("id", id)
    .eq("brand_id", user.id)

  if (error) return Response.json({ error: error.message }, { status: 400 })
  if (!count) return Response.json({ error: "Template not found" }, { status: 404 })
  return Response.json({ ok: true })
}
