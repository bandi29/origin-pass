import { NextResponse, type NextRequest } from "next/server"
import { checkRateLimitAsync } from "@/lib/rate-limit"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { isPassportInScope } from "@/backend/modules/organizations/scope"
import { translateTextsToLang } from "@/lib/google-translate"
import {
  EU_TRANSLATE_LANGS,
  englishSourceFromProduct,
  hashTranslationSource,
  isLangCacheFresh,
  nonemptySourceFields,
  parseTranslationsColumn,
  passportTranslationFieldsSchema,
  savePassportTranslationsBodySchema,
  translatePassportBodySchema,
  type EuTranslateLang,
  type PassportTranslationFields,
  type PassportTranslationsColumn,
} from "@/lib/passport-eu-translations"
import {
  PLAN_LIMITS,
  getSubscriptionTierForOrgId,
} from "@/lib/shopify-billing"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const FIELD_ORDER = ["materials", "origin", "care", "sustainability"] as const

async function requirePassportEditor(passportId: string): Promise<
  | { ok: true; userId: string }
  | { ok: false; response: NextResponse }
> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  }
  const inScope = await isPassportInScope(user.id, passportId)
  if (!inScope) {
    return { ok: false, response: NextResponse.json({ error: "Passport not found." }, { status: 404 }) }
  }
  return { ok: true, userId: user.id }
}

async function loadPassportSource(passportId: string): Promise<{
  source: PassportTranslationFields
  sourceHash: string
  column: PassportTranslationsColumn
} | null> {
  const admin = createAdminClient()
  const { data: passport, error } = await admin
    .from("passports")
    .select("id, product_id, translations, product:products(story,materials,origin,lifecycle)")
    .eq("id", passportId)
    .maybeSingle()

  if (error || !passport?.product_id) return null

  const product = (
    Array.isArray(passport.product) ? passport.product[0] : passport.product
  ) as
    | {
        story?: string | null
        materials?: string | null
        origin?: string | null
        lifecycle?: string | null
      }
    | null
    | undefined

  const source = englishSourceFromProduct({
    story: product?.story ?? "",
    materials: product?.materials ?? "",
    origin: product?.origin ?? "",
    lifecycle: product?.lifecycle ?? "",
  })

  return {
    source,
    sourceHash: hashTranslationSource(source),
    column: parseTranslationsColumn(passport.translations),
  }
}

async function translateFieldsForLang(
  source: PassportTranslationFields,
  lang: EuTranslateLang,
  existing: PassportTranslationFields | undefined,
  force: boolean,
  cacheFresh: boolean,
): Promise<{ fields: PassportTranslationFields; characters: number; fromCache: boolean }> {
  if (!force && cacheFresh && existing) {
    const parsed = passportTranslationFieldsSchema.safeParse(existing)
    if (parsed.success) {
      return { fields: parsed.data, characters: 0, fromCache: true }
    }
  }

  const base: PassportTranslationFields = {
    materials: "",
    origin: "",
    care: "",
    sustainability: "",
  }

  const toSend: string[] = []
  const sendKeys: Array<(typeof FIELD_ORDER)[number]> = []
  for (const key of FIELD_ORDER) {
    if (!source[key]) continue
    toSend.push(source[key])
    sendKeys.push(key)
  }

  if (toSend.length === 0) {
    return { fields: base, characters: 0, fromCache: false }
  }

  const { translations, characters } = await translateTextsToLang(toSend, lang)
  sendKeys.forEach((key, i) => {
    base[key] = translations[i] ?? source[key]
  })

  return { fields: base, characters, fromCache: false }
}

/**
 * POST /api/translate
 * Body: { passportId, targetLangs?: ['fr','de','es','it'], force?: boolean }
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  let json: unknown
  try {
    json = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 })
  }

  const parsed = translatePassportBodySchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid body." },
      { status: 400 },
    )
  }

  const { passportId, targetLangs, force } = parsed.data
  const auth = await requirePassportEditor(passportId)
  if (!auth.ok) return auth.response

  const adminForPlan = createAdminClient()
  const { data: passportPlanRow } = await adminForPlan
    .from("passports")
    .select("organization_id, product:products(organization_id)")
    .eq("id", passportId)
    .maybeSingle()
  const productOrg = (
    Array.isArray((passportPlanRow as { product?: unknown } | null)?.product)
      ? (passportPlanRow as { product: Array<{ organization_id?: string | null }> }).product[0]
      : (passportPlanRow as { product?: { organization_id?: string | null } } | null)?.product
  ) as { organization_id?: string | null } | null | undefined
  const orgId =
    (passportPlanRow as { organization_id?: string | null } | null)?.organization_id ??
    productOrg?.organization_id ??
    null
  const plan = await getSubscriptionTierForOrgId(orgId)
  if (!PLAN_LIMITS[plan].allowTranslations) {
    return NextResponse.json(
      {
        error:
          "Automated EU translations are available on Pro ($29/mo) and Scale. Starter Free is English only.",
        code: "PLAN_TRANSLATIONS_LOCKED",
      },
      { status: 403 },
    )
  }

  // Cloud Translation is metered and billable, and `force: true` deliberately
  // bypasses the source-hash cache — so an authenticated merchant could otherwise
  // loop this endpoint and run up spend. Mirrors the catalog-sync limiter.
  const rate = await checkRateLimitAsync(`translate:${auth.userId}`, 20, 10 * 60 * 1000)
  if (!rate.ok) {
    return NextResponse.json(
      { error: "Too many translation requests — please wait a few minutes and try again." },
      { status: 429 },
    )
  }

  const loaded = await loadPassportSource(passportId)
  if (!loaded) {
    return NextResponse.json({ error: "Passport not found." }, { status: 404 })
  }

  const { source, sourceHash, column } = loaded
  if (nonemptySourceFields(source).length === 0) {
    return NextResponse.json(
      { error: "Add English materials, origin, care, or sustainability text before translating." },
      { status: 400 },
    )
  }

  const langs = targetLangs.length > 0 ? targetLangs : [...EU_TRANSLATE_LANGS]
  const next: PassportTranslationsColumn = { ...column }
  let charactersUsed = 0
  const translated: EuTranslateLang[] = []
  const cached: EuTranslateLang[] = []

  try {
    for (const lang of langs) {
      const fresh = isLangCacheFresh(column, lang, sourceHash)
      const result = await translateFieldsForLang(source, lang, column[lang], force, fresh)
      next[lang] = result.fields
      charactersUsed += result.characters
      if (result.fromCache) cached.push(lang)
      else translated.push(lang)
    }
  } catch (error) {
    // Log the real cause server-side, but never return it: the underlying message
    // can name missing env vars (e.g. GOOGLE_TRANSLATE_API_KEY) to the client.
    console.error("[api/translate]", error instanceof Error ? error.message : error)
    return NextResponse.json(
      { error: "Translation service is unavailable right now. Please try again later." },
      { status: 502 },
    )
  }

  next._meta = { sourceHash, updatedAt: new Date().toISOString() }

  const admin = createAdminClient()
  const { error: saveError } = await admin
    .from("passports")
    .update({ translations: next, updated_at: new Date().toISOString() })
    .eq("id", passportId)

  if (saveError) {
    console.error("[api/translate] persist failed:", saveError.message)
    return NextResponse.json({ error: "Could not save translations." }, { status: 500 })
  }

  const { invalidatePassportCache } = await import("@/lib/passport-public-cache")
  await invalidatePassportCache(passportId)

  return NextResponse.json({
    ok: true,
    translations: next,
    translated,
    cached,
    charactersUsed,
  })
}

/**
 * PUT /api/translate — merchant manual edits to cached EU fields.
 * Body: { passportId, translations: { fr?: {...}, ... } }
 */
export async function PUT(request: NextRequest): Promise<NextResponse> {
  let json: unknown
  try {
    json = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 })
  }

  const parsed = savePassportTranslationsBodySchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid body." },
      { status: 400 },
    )
  }

  const { passportId, translations } = parsed.data
  const auth = await requirePassportEditor(passportId)
  if (!auth.ok) return auth.response

  const loaded = await loadPassportSource(passportId)
  if (!loaded) {
    return NextResponse.json({ error: "Passport not found." }, { status: 404 })
  }

  const next: PassportTranslationsColumn = {
    ...loaded.column,
    ...translations,
    _meta: {
      sourceHash: loaded.sourceHash,
      updatedAt: new Date().toISOString(),
    },
  }

  const admin = createAdminClient()
  const { error: saveError } = await admin
    .from("passports")
    .update({ translations: next, updated_at: new Date().toISOString() })
    .eq("id", passportId)

  if (saveError) {
    console.error("[api/translate] manual save failed:", saveError.message)
    return NextResponse.json({ error: "Could not save translations." }, { status: 500 })
  }

  const { invalidatePassportCache } = await import("@/lib/passport-public-cache")
  await invalidatePassportCache(passportId)

  return NextResponse.json({ ok: true, translations: next })
}
