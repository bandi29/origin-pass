import { getScopedPassportIds } from "@/backend/modules/organizations/scope"
import { generateAndStorePassportQr, mintPassportQrIdentities } from "@/lib/passport-qr-server"
import { qrcodeBodySchema } from "@/lib/passport-wizard-schemas"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { ensureBrandProfile } from "@/lib/tenancy"
import { schedulePassportStorefrontSync } from "@/lib/shopify-dpp-storefront-sync"

export async function POST(req: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  await ensureBrandProfile(supabase, user)

  let json: unknown
  try {
    json = await req.json()
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const parsed = qrcodeBodySchema.safeParse(json)
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Invalid body"
    return Response.json({ error: msg }, { status: 400 })
  }

  const { passportId, quantity } = parsed.data

  const scopedPassports = await getScopedPassportIds(user.id)
  if (!scopedPassports.includes(passportId)) {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }

  const admin = createAdminClient()
  const { data: passport } = await admin
    .from("passports")
    .select("id, organization_id, product:products(name)")
    .eq("id", passportId)
    .maybeSingle()

  if (!passport) {
    return Response.json({ error: "Passport not found." }, { status: 404 })
  }

  const productJoin = passport.product as { name?: string | null } | { name?: string | null }[] | null
  const productRow = Array.isArray(productJoin) ? productJoin[0] : productJoin
  const organizationId = (passport.organization_id as string | null) ?? null
  const wizardMetadata = {
    source: "passport_creation_wizard",
    mint_quantity: quantity,
  }

  try {
    if (quantity === 1) {
      const result = await generateAndStorePassportQr({
        passportId,
        organizationId,
        qrIdentityDisplayName: productRow?.name?.trim() || null,
        qrIdentityMetadata: wizardMetadata,
      })
      schedulePassportStorefrontSync(passportId)
      return Response.json({
        publicPageUrl: result.publicPageUrl,
        imageDataUrl: result.imageDataUrl,
        imagePublicUrl: result.imagePublicUrl,
        qrCodeRowId: result.qrCodeRowId,
        qrIdentityId: result.qrIdentityId ?? null,
        mintedCount: 1,
      })
    }

    const batch = await mintPassportQrIdentities({
      passportId,
      organizationId,
      quantity,
      qrIdentityDisplayName: productRow?.name?.trim() || null,
      qrIdentityMetadata: wizardMetadata,
    })

    schedulePassportStorefrontSync(passportId)

    return Response.json({
      publicPageUrl: batch.primary.publicPageUrl,
      imageDataUrl: batch.primary.imageDataUrl,
      imagePublicUrl: batch.primary.imagePublicUrl,
      qrCodeRowId: batch.primary.qrCodeRowId,
      qrIdentityId: batch.primary.qrIdentityId ?? null,
      mintedCount: batch.totalMinted,
    })
  } catch (e) {
    console.error("generate QR:", e)
    return Response.json({ error: "Could not generate QR code." }, { status: 500 })
  }
}
