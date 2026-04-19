import { createComplianceProduct } from "@/actions/create-compliance-product"
import { CATEGORY_KEYS } from "@/lib/compliance/category-schemas"
import { createProductBodySchema } from "@/lib/passport-wizard-schemas"
import {
  getOrganizationIdForUser,
  insertProductFromWizard,
} from "@/lib/passport-wizard-product"
import { createClient } from "@/lib/supabase/server"
import { ensureBrandProfile } from "@/lib/tenancy"
import { z } from "zod"

const complianceProductApiSchema = z.object({
  complianceCategoryKey: z.enum(CATEGORY_KEYS),
  name: z.string().min(1).max(500),
  sku: z.string().max(200).optional().nullable(),
  complianceData: z.record(z.string(), z.unknown()).optional().default({}),
})

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

  if (json && typeof json === "object" && json !== null && "complianceCategoryKey" in json) {
    const parsedCompliance = complianceProductApiSchema.safeParse(json)
    if (!parsedCompliance.success) {
      const msg = parsedCompliance.error.issues[0]?.message ?? "Invalid compliance product body"
      return Response.json({ error: msg }, { status: 400 })
    }
    const result = await createComplianceProduct(parsedCompliance.data)
    if (!result.success) {
      return Response.json({ error: result.error ?? "Validation failed" }, { status: 400 })
    }
    return Response.json({
      productId: result.productId,
      dppReadinessScore: result.dppReadinessScore,
    })
  }

  const parsed = createProductBodySchema.safeParse(json)
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Invalid body"
    return Response.json({ error: msg }, { status: 400 })
  }

  const organizationId = await getOrganizationIdForUser(user.id)

  const result = await insertProductFromWizard({
    userId: user.id,
    organizationId,
    name: parsed.data.name,
    description: parsed.data.description ?? null,
    category: parsed.data.category ?? null,
    originCountry: parsed.data.originCountry ?? null,
    originRegion: parsed.data.originRegion ?? null,
  })

  if ("error" in result) {
    return Response.json({ error: result.error }, { status: 500 })
  }

  return Response.json({ productId: result.productId })
}
