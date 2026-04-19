import { createClient } from "@/lib/supabase/server"
import { buildProductJsonLd } from "@/lib/dpp-export"
import { ensureBrandProfile } from "@/lib/tenancy"
import { getScopedProductIds } from "@/backend/modules/organizations/scope"

function isMissingJsonLdColumn(error: unknown): boolean {
  if (!error || typeof error !== "object") return false
  const code = "code" in error ? String((error as { code?: unknown }).code ?? "") : ""
  const message = "message" in error ? String((error as { message?: unknown }).message ?? "") : ""
  return code === "PGRST204" && message.includes("json_ld")
}

export async function requireProductOwner(productId: string): Promise<{
  ok: false
  response: Response
} | { ok: true; supabase: Awaited<ReturnType<typeof createClient>>; userId: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return {
      ok: false,
      response: Response.json({ error: "Unauthorized" }, { status: 401 }),
    }
  }

  await ensureBrandProfile(supabase, user)

  const scoped = await getScopedProductIds(user.id)
  if (!scoped.includes(productId)) {
    return {
      ok: false,
      response: Response.json({ error: "Forbidden" }, { status: 403 }),
    }
  }

  return { ok: true, supabase, userId: user.id }
}

export async function insertProductFromWizard(input: {
  userId: string
  organizationId: string | null
  name: string
  description: string | null
  category: string | null
  originCountry: string | null
  originRegion: string | null
}): Promise<{ productId: string } | { error: string }> {
  const supabase = await createClient()

  const originParts = [input.originCountry, input.originRegion].filter(Boolean)
  const origin = originParts.length ? originParts.join(" — ") : null

  const { data: brand } = await supabase
    .from("profiles")
    .select("brand_name")
    .eq("id", input.userId)
    .single()

  const jsonLd = buildProductJsonLd({
    name: input.name,
    story: input.description ?? null,
    materials: null,
    origin,
    lifecycle: null,
    imageUrl: null,
    brandName: brand?.brand_name ?? null,
  })

  const basePayload = {
    brand_id: input.userId,
    organization_id: input.organizationId,
    name: input.name,
    description: input.description,
    category: input.category,
    origin,
    story: null,
    materials: null,
    image_url: null,
    is_archived: false,
    metadata: {
      originCountry: input.originCountry ?? "",
      originRegion: input.originRegion ?? "",
    },
    json_ld: jsonLd,
  }

  const { data: product, error } = await supabase
    .from("products")
    .insert(basePayload as never)
    .select("id")
    .single()

  if (error) {
    if (error.message?.includes("metadata") || String(error).includes("metadata")) {
      const { metadata: _meta, ...noMeta } = basePayload as Record<string, unknown>
      const { data: p2, error: e2 } = await supabase
        .from("products")
        .insert(noMeta as never)
        .select("id")
        .single()
      if (!e2 && p2?.id) return { productId: p2.id as string }
    }
    if (isMissingJsonLdColumn(error)) {
      const { metadata: _m, json_ld: _j, ...rest } = basePayload as Record<string, unknown>
      const { data: fallback, error: e2 } = await supabase
        .from("products")
        .insert(rest as never)
        .select("id")
        .single()
      if (!e2 && fallback?.id) return { productId: fallback.id as string }
    }
    console.error("insertProductFromWizard:", error)
    return { error: "Could not create product." }
  }

  return { productId: product?.id as string }
}

export async function getOrganizationIdForUser(userId: string): Promise<string | null> {
  const supabase = await createClient()
  try {
    const { data: userRow } = await supabase
      .from("users")
      .select("organization_id")
      .eq("id", userId)
      .maybeSingle()
    return userRow?.organization_id ?? null
  } catch {
    return null
  }
}
