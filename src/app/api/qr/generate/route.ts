import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { isProductInScope } from "@/backend/modules/organizations/scope"
import { generateAndStorePassportQr } from "@/lib/passport-qr-server"

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const body = (await request.json().catch(() => null)) as {
    productId?: string
    securityLevel?: "basic" | "standard" | "enterprise"
    wizard?: Record<string, unknown> | null
    complianceRemediation?: {
      originCountry?: string | null
      heroImageUrl?: string | null
      useBrandLogoPlaceholder?: boolean
    } | null
  } | null
  if (!body?.productId) return Response.json({ error: "productId is required" }, { status: 400 })

  if (!(await isProductInScope(user.id, body.productId))) {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }

  const admin = createAdminClient()
  const [{ data: product }, { data: passport }, { data: existingActive }, { data: userRow }] = await Promise.all([
    admin
      .from("products")
      .select("id, compliance_data, verification_status, qr_identity_id, risk_score")
      .eq("id", body.productId)
      .maybeSingle(),
    admin
      .from("passports")
      .select("id, status, organization_id")
      .eq("product_id", body.productId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from("qr_identities")
      .select("id")
      .eq("product_id", body.productId)
      .in("activation_status", ["active", "pending"])
      .limit(1)
      .maybeSingle(),
    admin.from("users").select("organization_id").eq("id", user.id).maybeSingle(),
  ])

  if (!product) return Response.json({ error: "Product not found" }, { status: 404 })
  if (!passport) return Response.json({ error: "Passport must be generated first." }, { status: 400 })
  if (passport.status !== "active") return Response.json({ error: "Passport must be active before QR generation." }, { status: 400 })
  if (existingActive?.id) {
    return Response.json({ error: "An immutable active/pending QR already exists for this product." }, { status: 409 })
  }

  const complianceData = { ...((product.compliance_data ?? {}) as Record<string, unknown>) }
  const remediation = body.complianceRemediation ?? null
  const wizardRemediation =
    body.wizard && typeof body.wizard === "object" && body.wizard.complianceRemediation
      ? (body.wizard.complianceRemediation as {
          originCountry?: string | null
          heroImageUrl?: string | null
          useBrandLogoPlaceholder?: boolean
        })
      : null
  const effectiveRemediation = remediation ?? wizardRemediation

  if (effectiveRemediation?.originCountry?.trim()) {
    complianceData.origin_country = effectiveRemediation.originCountry.trim()
  }

  let heroImageUrl =
    typeof effectiveRemediation?.heroImageUrl === "string" && effectiveRemediation.heroImageUrl.trim()
      ? effectiveRemediation.heroImageUrl.trim()
      : typeof complianceData.hero_image_url === "string"
        ? complianceData.hero_image_url.trim()
        : ""

  if (!heroImageUrl && effectiveRemediation?.useBrandLogoPlaceholder) {
    const orgId = passport.organization_id ?? userRow?.organization_id ?? null
    if (orgId) {
      const { data: org } = await admin.from("organizations").select("logo_url").eq("id", orgId).maybeSingle()
      const logo = typeof org?.logo_url === "string" ? org.logo_url.trim() : ""
      if (logo) heroImageUrl = logo
    }
  }

  const originCountry =
    typeof complianceData.origin_country === "string" ? complianceData.origin_country.trim() : ""

  if (!originCountry && !heroImageUrl) {
    return Response.json(
      { error: "Add a country of origin, upload a hero image, or enable the brand logo placeholder." },
      { status: 400 },
    )
  }

  if (effectiveRemediation && (originCountry || heroImageUrl)) {
    if (heroImageUrl) complianceData.hero_image_url = heroImageUrl
    const { error: patchErr } = await admin
      .from("products")
      .update({
        compliance_data: complianceData,
        ...(originCountry ? { origin: originCountry } : {}),
        ...(heroImageUrl ? { image_url: heroImageUrl } : {}),
      })
      .eq("id", body.productId)
    if (patchErr) {
      console.warn("qr/generate compliance patch:", patchErr.message)
    }
  }

  const displayName =
    typeof body.wizard?.identityName === "string" && body.wizard.identityName.trim().length > 0
      ? body.wizard.identityName.trim()
      : null

  const wizardSnapshot = {
    ...(body.wizard ?? {}),
    securityLevel: body.securityLevel ?? "standard",
    generatedByUserId: user.id,
    generatedAt: new Date().toISOString(),
  }

  const result = await generateAndStorePassportQr({
    passportId: passport.id,
    organizationId: passport.organization_id ?? userRow?.organization_id ?? null,
    qrIdentityDisplayName: displayName,
    qrIdentityMetadata: wizardSnapshot,
  })

  const orgId = passport.organization_id ?? userRow?.organization_id ?? null

  await admin.from("qr_activation_logs").insert({
    qr_identity_id: result.qrIdentityId ?? null,
    product_id: body.productId,
    organization_id: orgId,
    actor_user_id: user.id,
    previous_status: "pending",
    next_status: "active",
    reason: "QR generated from dashboard",
    metadata: {
      securityLevel: body.securityLevel ?? "standard",
      qrCodeRowId: result.qrCodeRowId,
      wizard: body.wizard ?? null,
    },
  })

  const risk = Number((product as { risk_score?: number | null }).risk_score ?? 0)

  const { error: veErr } = await admin.from("verification_events").insert({
    product_id: body.productId,
    organization_id: orgId,
    event_type: "qr_identity_generated",
    event_message: "Secure QR identity issued for product passport",
    score_change: 0,
    risk_before: risk,
    risk_after: risk,
    metadata_json: {
      qr_identity_id: result.qrIdentityId,
      qr_code_row_id: result.qrCodeRowId,
      wizard: body.wizard ?? null,
    },
  })
  if (veErr) console.warn("verification_events insert:", veErr.message)

  return Response.json({
    qrIdentityId: result.qrIdentityId ?? null,
    qrCodeRowId: result.qrCodeRowId,
    publicPageUrl: result.publicPageUrl,
    imagePublicUrl: result.imagePublicUrl,
    imageDataUrl: result.imageDataUrl,
  })
}
