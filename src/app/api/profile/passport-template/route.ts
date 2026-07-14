import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { normalizePassportTemplateKey } from "@/lib/passport-display-templates"

export async function POST(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const templateKeyRaw =
    typeof body === "object" && body !== null && "templateKey" in body
      ? (body as { templateKey: unknown }).templateKey
      : null

  const templateKey = normalizePassportTemplateKey(
    typeof templateKeyRaw === "string" ? templateKeyRaw : "classic",
  )

  const { error } = await supabase
    .from("profiles")
    .update({ passport_template_key: templateKey })
    .eq("id", user.id)

  if (error) {
    console.error("passport-template update:", error)
    const missingColumn =
      error.code === "PGRST204" ||
      (typeof error.message === "string" &&
        error.message.includes("passport_template_key") &&
        error.message.includes("schema cache"))
    if (missingColumn) {
      return NextResponse.json(
        {
          error:
            "Database is missing column profiles.passport_template_key. Apply migrations (e.g. `supabase db push` or run migration 20260510120000_passport_display_template.sql), then reload PostgREST if needed.",
        },
        { status: 503 },
      )
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, templateKey })
}
