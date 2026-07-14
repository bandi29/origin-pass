import { createClient } from "@/lib/supabase/server"

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const { data, error } = await supabase
    .from("label_print_jobs")
    .select("*, template:label_templates(name)")
    .eq("brand_id", user.id)
    .order("created_at", { ascending: false })
    .limit(200)

  if (error) return Response.json({ error: error.message }, { status: 400 })
  return Response.json({ jobs: data ?? [] })
}
