import { createClient } from "@/lib/supabase/server"

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const body = (await request.json().catch(() => ({}))) as {
    printJobId?: string
    format?: string
    assetCount?: number
    status?: string
  }
  const format = (body.format ?? "pdf").toLowerCase()
  const assetCount = Math.max(1, Number(body.assetCount ?? 1))
  const status =
    body.status === "queued" || body.status === "processing"
      ? body.status
      : assetCount >= 12
        ? "queued"
        : "completed"

  const { data, error } = await supabase
    .from("label_exports")
    .insert({
      brand_id: user.id,
      print_job_id: body.printJobId ?? null,
      export_format: format,
      status,
      file_name: `originpass-label-export-${Date.now()}.${format === "zip" ? "zip" : format}`,
      secure_url: null,
      asset_count: assetCount,
      created_by: user.id,
    })
    .select("*")
    .single()

  if (error) return Response.json({ error: error.message }, { status: 400 })
  return Response.json({ export: data })
}
