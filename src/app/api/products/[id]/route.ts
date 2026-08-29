import { summarizeMaterials, summarizeOrigin } from "@/lib/compliance/compliance-field-summaries"
import { buildProductJsonLd } from "@/lib/dpp-export"
import type { CategoryKey } from "@/lib/compliance/category-schemas"
import type { ComplianceData } from "@/lib/compliance/category-compliance-strategy"
import { patchProductBodySchema } from "@/lib/passport-wizard-schemas"
import { requireProductOwner } from "@/lib/passport-wizard-product"
import { createClient } from "@/lib/supabase/server"

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: Request, ctx: Ctx) {
  const { id: productId } = await ctx.params
  const gate = await requireProductOwner(productId)
  if (!gate.ok) return gate.response

  const supabase = await createClient()
  const { data: product, error: pErr } = await supabase
    .from("products")
    .select("id, name, description, category, origin, metadata, story, materials, sku, compliance_category_key, compliance_data, image_url")
    .eq("id", productId)
    .single()

  if (pErr || !product) {
    return Response.json({ error: "Not found" }, { status: 404 })
  }

  const { data: passport } = await supabase
    .from("passports")
    .select("id, metadata, gpsr")
    .eq("product_id", productId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()

  const meta = product.metadata as { originCountry?: string; originRegion?: string } | null
  let originCountry = meta?.originCountry ?? ""
  let originRegion = meta?.originRegion ?? ""
  if (!originCountry && product.origin) {
    const parts = String(product.origin).split(" — ")
    originCountry = parts[0]?.trim() ?? ""
    originRegion = parts.slice(1).join(" — ").trim() ?? ""
  }

  const pm = passport?.metadata as
    | {
        wizard?: {
          story?: string
          materials?: unknown[]
          timeline?: unknown[]
          industryTemplateId?: string | null
          customFields?: Record<string, string>
        }
      }
    | null
    | undefined
  const wizard = pm?.wizard

  return Response.json({
    product: {
      id: product.id,
      name: product.name,
      description: product.description,
      category: product.category,
      origin: product.origin,
      originCountry,
      originRegion,
      sku: (product as { sku?: string | null }).sku ?? null,
      complianceCategoryKey: (product as { compliance_category_key?: string | null }).compliance_category_key ?? null,
      complianceData: (product as { compliance_data?: ComplianceData | null }).compliance_data ?? {},
    },
    passport: passport
      ? {
          id: passport.id,
          story: wizard?.story ?? null,
          materials: wizard?.materials ?? [],
          timeline: wizard?.timeline ?? [],
          industryTemplateId: wizard?.industryTemplateId ?? null,
          customFields: wizard?.customFields ?? {},
          gpsr: (passport as { gpsr?: unknown }).gpsr ?? {},
        }
      : null,
  })
}

export async function PATCH(req: Request, ctx: Ctx) {
  const { id: productId } = await ctx.params
  const gate = await requireProductOwner(productId)
  if (!gate.ok) return gate.response

  let json: unknown
  try {
    json = await req.json()
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const parsed = patchProductBodySchema.safeParse(json)
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Invalid body"
    return Response.json({ error: msg }, { status: 400 })
  }

  const body = parsed.data
  if (body.name !== undefined && body.name.trim().length < 3) {
    return Response.json({ error: "Name must be at least 3 characters" }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: profile } = await supabase
    .from("profiles")
    .select("brand_name")
    .eq("id", gate.userId)
    .maybeSingle()

  const originParts = [body.originCountry, body.originRegion].filter(
    (x) => x != null && String(x).trim() !== ""
  )
  const origin =
    originParts.length > 0 ? originParts.map((x) => String(x).trim()).join(" — ") : undefined

  const { data: current } = await supabase
    .from("products")
    .select("name, description, category, origin, story, materials, image_url, metadata, sku, compliance_category_key, compliance_data")
    .eq("id", productId)
    .single()

  if (!current) {
    return Response.json({ error: "Not found" }, { status: 404 })
  }

  const nextName = body.name !== undefined ? body.name.trim() : current.name
  const nextDesc = body.description !== undefined ? body.description : current.description
  const nextCat = body.category !== undefined ? body.category : current.category
  const nextOrigin = origin !== undefined ? origin : current.origin

  const storedComplianceKey = (current.compliance_category_key as CategoryKey | null) ?? null
  const effectiveComplianceKey: CategoryKey | null =
    body.complianceCategoryKey !== undefined ? body.complianceCategoryKey : storedComplianceKey
  const prevCompliance = (current.compliance_data as ComplianceData | null) ?? {}
  const mergedCompliance: ComplianceData =
    effectiveComplianceKey && body.complianceData
      ? ({ ...prevCompliance, ...body.complianceData } as ComplianceData)
      : prevCompliance

  const metadata = {
    ...((current.metadata as Record<string, unknown>) || {}),
    ...(body.originCountry !== undefined || body.originRegion !== undefined
      ? {
          originCountry: body.originCountry ?? "",
          originRegion: body.originRegion ?? "",
        }
      : {}),
  }

  const nextStory =
    effectiveComplianceKey && body.complianceData
      ? String(mergedCompliance.product_story ?? "").trim() || null
      : (current.story as string | null)
  const nextMaterials =
    effectiveComplianceKey && body.complianceData
      ? summarizeMaterials(effectiveComplianceKey, mergedCompliance) || null
      : (current.materials as string | null)
  const nextOriginCol =
    effectiveComplianceKey && body.complianceData
      ? summarizeOrigin(mergedCompliance) || null
      : (nextOrigin as string | null)
  const heroUrl = String(mergedCompliance.hero_image_url ?? "").trim()
  const nextImageUrl =
    effectiveComplianceKey && body.complianceData
      ? heroUrl || (current.image_url as string | null)
      : (current.image_url as string | null)

  const jsonLdStory = effectiveComplianceKey
    ? String(mergedCompliance.product_story ?? "").trim() || null
    : ((nextDesc as string | null) ?? null)
  const jsonLdMaterials = effectiveComplianceKey
    ? summarizeMaterials(effectiveComplianceKey, mergedCompliance) || null
    : ((current.materials as string | null) ?? null)
  const jsonLdOrigin = effectiveComplianceKey
    ? summarizeOrigin(mergedCompliance) || null
    : ((nextOrigin as string | null) ?? null)

  const jsonLd = buildProductJsonLd({
    name: nextName,
    story: jsonLdStory,
    materials: jsonLdMaterials,
    origin: jsonLdOrigin,
    lifecycle: null,
    imageUrl: (nextImageUrl as string | null) ?? null,
    brandName: profile?.brand_name ?? null,
  })

  const updatePayload: Record<string, unknown> = {
    name: nextName,
    description: nextDesc,
    category: nextCat,
    origin: effectiveComplianceKey && body.complianceData ? nextOriginCol : nextOrigin,
    json_ld: jsonLd,
    metadata,
  }

  if (body.sku !== undefined) {
    updatePayload.sku = body.sku
  }

  if (body.complianceCategoryKey !== undefined) {
    updatePayload.compliance_category_key = body.complianceCategoryKey
  }

  if (effectiveComplianceKey && body.complianceData) {
    updatePayload.compliance_data = mergedCompliance
    updatePayload.story = nextStory
    updatePayload.materials = nextMaterials
    updatePayload.origin = nextOriginCol
    updatePayload.image_url = nextImageUrl
  }

  if (body.issuanceRemediation) {
    const remediatedCompliance = {
      ...((updatePayload.compliance_data as ComplianceData | undefined) ?? prevCompliance),
    }
    const irOrigin = body.issuanceRemediation.originCountry?.trim()
    const irHero = body.issuanceRemediation.heroImageUrl?.trim()
    if (irOrigin) {
      remediatedCompliance.origin_country = irOrigin
      updatePayload.origin = irOrigin
      ;(metadata as Record<string, unknown>).originCountry = irOrigin
    }
    if (irHero) {
      remediatedCompliance.hero_image_url = irHero
      updatePayload.image_url = irHero
    }
    updatePayload.compliance_data = remediatedCompliance
    updatePayload.metadata = metadata
  }

  const { error } = await supabase.from("products").update(updatePayload as never).eq("id", productId)

  if (error) {
    if (String(error.message || "").includes("metadata")) {
      const { metadata: _m, ...rest } = updatePayload
      const { error: e2 } = await supabase.from("products").update(rest as never).eq("id", productId)
      if (!e2) return Response.json({ ok: true })
    }
    if (String(error.message || "").includes("json_ld")) {
      const { json_ld: _j, ...rest } = updatePayload
      const { error: e2 } = await supabase.from("products").update(rest as never).eq("id", productId)
      if (!e2) return Response.json({ ok: true })
    }
    console.error("PATCH product:", error)
    return Response.json({ error: "Update failed" }, { status: 500 })
  }

  return Response.json({ ok: true })
}
