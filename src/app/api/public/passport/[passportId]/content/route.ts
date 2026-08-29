import { createAdminClient } from "@/lib/supabase/admin"
import {
  isPublicPassportLang,
  parseTranslationsColumn,
  translationFieldsHaveContent,
  type PublicPassportLang,
} from "@/lib/passport-eu-translations"

export type PublicPassportContentResponse = {
  language: PublicPassportLang
  found: boolean
  /** Sustainability / product story */
  story: string
  /** Flat materials copy (preferred for Google-translated langs) */
  materialsText: string | null
  origin: string | null
  care: string | null
  /** Wizard structured materials (EN only when present) */
  materials: Array<{ name?: string; source?: string; sustainabilityTag?: string }>
  timeline: Array<{ stepName?: string; location?: string; date?: string }>
  /** @deprecated alias of materialsText for older clients */
  legacyMaterials: string | null
  source: "en" | "translations" | "none"
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ passportId: string }> },
) {
  const { passportId } = await ctx.params
  const url = new URL(req.url)
  const langRaw = (url.searchParams.get("lang") || "en").toLowerCase()

  if (!isPublicPassportLang(langRaw)) {
    return Response.json({ error: "Unsupported language" }, { status: 400 })
  }
  const lang: PublicPassportLang = langRaw

  const admin = createAdminClient()
  const { data: passport } = await admin
    .from("passports")
    .select("id, status, metadata, product_id, translations")
    .eq("id", passportId)
    .maybeSingle()

  if (!passport || passport.status === "revoked" || passport.status === "expired") {
    return Response.json({ error: "Not found" }, { status: 404 })
  }

  const { data: product } = await admin
    .from("products")
    .select("story, materials, origin, lifecycle")
    .eq("id", passport.product_id)
    .maybeSingle()

  const meta = passport.metadata as {
    wizard?: {
      story?: string
      materials?: Array<{ name?: string; source?: string; sustainabilityTag?: string }>
      timeline?: Array<{ stepName?: string; location?: string; date?: string }>
    }
  } | null

  const wizard = meta?.wizard
  const enStory =
    (wizard?.story && wizard.story.trim()) || (product?.story as string | null)?.trim() || ""
  const enMaterialsText = (product?.materials as string | null)?.trim() || null
  const enOrigin = (product?.origin as string | null)?.trim() || null
  const enCare = (product?.lifecycle as string | null)?.trim() || null
  const structuredMaterials = wizard?.materials ?? []
  const timeline = wizard?.timeline ?? []

  if (lang === "en") {
    const body: PublicPassportContentResponse = {
      language: "en",
      found: true,
      story: enStory,
      materialsText: enMaterialsText,
      origin: enOrigin,
      care: enCare,
      materials: structuredMaterials,
      timeline,
      legacyMaterials: enMaterialsText,
      source: "en",
    }
    return Response.json(body)
  }

  const column = parseTranslationsColumn(passport.translations)
  const fields = column[lang]
  if (!translationFieldsHaveContent(fields)) {
    const body: PublicPassportContentResponse = {
      language: lang,
      found: false,
      story: enStory,
      materialsText: enMaterialsText,
      origin: enOrigin,
      care: enCare,
      materials: structuredMaterials,
      timeline,
      legacyMaterials: enMaterialsText,
      source: "none",
    }
    return Response.json(body)
  }

  const body: PublicPassportContentResponse = {
    language: lang,
    found: true,
    story: fields!.sustainability?.trim() || "",
    materialsText: fields!.materials?.trim() || null,
    origin: fields!.origin?.trim() || null,
    care: fields!.care?.trim() || null,
    materials: [],
    timeline: [],
    legacyMaterials: fields!.materials?.trim() || null,
    source: "translations",
  }
  return Response.json(body)
}
