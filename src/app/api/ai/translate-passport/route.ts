import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getScopedPassportIds } from "@/backend/modules/organizations/scope"
import { getPassportTranslation, upsertPassportTranslation } from "@/backend/modules/passport-translations/repository"
import { translatePassportWithOpenAI } from "@/lib/ai-translate-passport"
import { hashIpForStorage } from "@/lib/ip-hash"
import { checkTranslateRateLimit } from "@/lib/translate-rate-limit"
import { ensureBrandProfile } from "@/lib/tenancy"

const bodySchema = z.object({
  passportId: z.string().uuid(),
  targetLanguage: z.enum(["fr", "es", "it"]),
})

type WizardMeta = {
  story?: string
  materials?: Array<{ name?: string; source?: string; sustainabilityTag?: string }>
  timeline?: Array<{ stepName?: string; location?: string; date?: string }>
}

function clientIp(request: Request): string | null {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null
}

export async function POST(req: Request) {
  let json: unknown
  try {
    json = await req.json()
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid body" }, { status: 400 })
  }

  const { passportId, targetLanguage } = parsed.data

  const existing = await getPassportTranslation(passportId, targetLanguage)
  if (existing) {
    return Response.json({ ok: true, cached: true })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let allowed = false
  if (user) {
    await ensureBrandProfile(supabase, user)
    const scoped = await getScopedPassportIds(user.id)
    allowed = scoped.includes(passportId)
  }

  if (!allowed) {
    const ipHash = hashIpForStorage(clientIp(req))
    if (!checkTranslateRateLimit(ipHash).ok) {
      return Response.json({ error: "Translation rate limit exceeded. Try later." }, { status: 429 })
    }
  }

  const admin = createAdminClient()
  const { data: passport, error: pErr } = await admin
    .from("passports")
    .select("id, status, metadata, product_id")
    .eq("id", passportId)
    .maybeSingle()

  if (pErr || !passport || passport.status === "revoked" || passport.status === "expired") {
    return Response.json({ error: "Passport not found" }, { status: 404 })
  }

  const { data: product } = await admin
    .from("products")
    .select("story")
    .eq("id", passport.product_id)
    .maybeSingle()

  const meta = passport.metadata as { wizard?: WizardMeta } | null | undefined
  const wizard = meta?.wizard
  const story =
    (wizard?.story && wizard.story.trim()) || (product?.story as string | null)?.trim() || ""

  const materials = (wizard?.materials ?? []).filter((m) => m?.name || m?.source)
  const timeline = (wizard?.timeline ?? []).filter((t) => t?.stepName || t?.location || t?.date)

  if (!story && materials.length === 0 && timeline.length === 0) {
    return Response.json({ error: "Nothing to translate yet." }, { status: 400 })
  }

  try {
    const translated = await translatePassportWithOpenAI(targetLanguage, {
      story,
      materials,
      timeline,
    })

    await upsertPassportTranslation({
      passportId,
      language: targetLanguage,
      story: translated.story || null,
      materials: translated.materials,
      timeline: translated.timeline,
    })

    return Response.json({ ok: true, cached: false })
  } catch (e) {
    console.error("translate-passport:", e)
    const msg = e instanceof Error ? e.message : "Translation failed"
    if (msg.includes("OPENAI_API_KEY")) {
      return Response.json({ error: "Translation is not configured on this server." }, { status: 503 })
    }
    return Response.json({ error: "Could not translate passport." }, { status: 500 })
  }
}
