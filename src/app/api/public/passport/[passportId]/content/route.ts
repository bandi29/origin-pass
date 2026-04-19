import { createAdminClient } from "@/lib/supabase/admin"
import { getPassportTranslation } from "@/backend/modules/passport-translations/repository"

const LANGS = new Set(["en", "fr", "es", "it"])

export async function GET(
  req: Request,
  ctx: { params: Promise<{ passportId: string }> }
) {
  const { passportId } = await ctx.params
  const url = new URL(req.url)
  const lang = (url.searchParams.get("lang") || "en").toLowerCase()

  if (!LANGS.has(lang)) {
    return Response.json({ error: "Unsupported language" }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: passport } = await admin
    .from("passports")
    .select("id, status, metadata, product_id")
    .eq("id", passportId)
    .maybeSingle()

  if (!passport || passport.status === "revoked" || passport.status === "expired") {
    return Response.json({ error: "Not found" }, { status: 404 })
  }

  if (lang === "en") {
    const { data: product } = await admin
      .from("products")
      .select("story, materials")
      .eq("id", passport.product_id)
      .maybeSingle()

    const meta = passport.metadata as {
      wizard?: {
        story?: string
        materials?: unknown[]
        timeline?: unknown[]
      }
    } | null

    const wizard = meta?.wizard
    const story =
      (wizard?.story && wizard.story.trim()) || (product?.story as string | null)?.trim() || ""
    const materials = wizard?.materials ?? []
    const timeline = wizard?.timeline ?? []

    return Response.json({
      language: "en",
      found: true,
      story,
      materials,
      timeline,
      legacyMaterials: (product?.materials as string | null) ?? null,
    })
  }

  const row = await getPassportTranslation(passportId, lang)
  if (!row) {
    return Response.json({ language: lang, found: false })
  }

  return Response.json({
    language: lang,
    found: true,
    story: row.story ?? "",
    materials: row.materials ?? [],
    timeline: row.timeline ?? [],
    legacyMaterials: null,
  })
}
