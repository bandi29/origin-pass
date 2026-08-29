import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  buildHangtagLabelData,
  hangtagPdfFilename,
  isHangtagLayoutType,
  loadHangtagPassportSource,
  renderHangtagPdf,
  type HangtagLayoutType,
} from "@/lib/hangtag-pdf"
import { PLAN_LIMITS, getSubscriptionTierForOrgId } from "@/lib/shopify-billing"

export const runtime = "nodejs"

type RouteContext = {
  params: Promise<{ id: string }>
}

/**
 * Print-ready hangtag / label PDF export.
 *
 * Query:
 *   layoutType = hangtag-2x3 | avery-5160 | thermal-4x6
 *   variantGtin = optional GTIN override for the GS1 Digital Link QR
 */
export async function GET(request: Request, context: RouteContext) {
  const { id: passportId } = await context.params
  const { searchParams } = new URL(request.url)
  const layoutRaw = (searchParams.get("layoutType") ?? "hangtag-2x3").trim()
  const variantGtin = searchParams.get("variantGtin")?.trim() || null

  if (!isHangtagLayoutType(layoutRaw)) {
    return Response.json(
      {
        error: 'Invalid layoutType. Use "hangtag-2x3", "avery-5160", or "thermal-4x6".',
      },
      { status: 400 },
    )
  }
  const layoutType = layoutRaw as HangtagLayoutType

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const needsPaidLabels = layoutType === "avery-5160" || layoutType === "thermal-4x6"
  if (needsPaidLabels) {
    const admin = createAdminClient()
    const { data: passportRow } = await admin
      .from("passports")
      .select("organization_id, product:products(organization_id)")
      .eq("id", passportId)
      .maybeSingle()
    const productOrg = (
      Array.isArray((passportRow as { product?: unknown } | null)?.product)
        ? (passportRow as { product: Array<{ organization_id?: string | null }> }).product[0]
        : (passportRow as { product?: { organization_id?: string | null } } | null)?.product
    ) as { organization_id?: string | null } | null | undefined
    const orgId =
      (passportRow as { organization_id?: string | null } | null)?.organization_id ??
      productOrg?.organization_id ??
      null
    const plan = await getSubscriptionTierForOrgId(orgId)
    if (!PLAN_LIMITS[plan].allowLabelExports) {
      return Response.json(
        {
          error:
            "Avery and Thermal label exports are available on Pro ($29/mo) and Scale. Upgrade to unlock print layouts.",
          code: "PLAN_LABEL_EXPORTS_LOCKED",
        },
        { status: 403 },
      )
    }
  }

  try {
    const source = await loadHangtagPassportSource(user.id, passportId, { variantGtin })
    if (!source) {
      return Response.json({ error: "Passport not found" }, { status: 404 })
    }

    const label = await buildHangtagLabelData(source)
    const pdfBuffer = await renderHangtagPdf(layoutType, label)
    const filename = hangtagPdfFilename(label.gtinDisplay, source.serialNumber, layoutType)

    return new Response(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
        "X-OriginPass-Layout": layoutType,
        "X-OriginPass-Link-Type": label.linkType,
      },
    })
  } catch (error) {
    console.error("[export-pdf] failed:", error)
    return Response.json({ error: "Could not generate print PDF." }, { status: 500 })
  }
}
