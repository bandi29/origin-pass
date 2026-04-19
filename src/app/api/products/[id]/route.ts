import { buildProductJsonLd } from "@/lib/dpp-export"
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
    .select("id, name, description, category, origin, metadata, story, materials")
    .eq("id", productId)
    .single()

  if (pErr || !product) {
    return Response.json({ error: "Not found" }, { status: 404 })
  }

  const { data: passport } = await supabase
    .from("passports")
    .select("id, metadata")
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
    | { wizard?: { story?: string; materials?: unknown[]; timeline?: unknown[] } }
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
    },
    passport: passport
      ? {
          id: passport.id,
          story: wizard?.story ?? null,
          materials: wizard?.materials ?? [],
          timeline: wizard?.timeline ?? [],
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
    .select("name, description, category, origin, story, materials, image_url, metadata")
    .eq("id", productId)
    .single()

  if (!current) {
    return Response.json({ error: "Not found" }, { status: 404 })
  }

  const nextName = body.name?.trim() ?? current.name
  const nextDesc = body.description !== undefined ? body.description : current.description
  const nextCat = body.category !== undefined ? body.category : current.category
  const nextOrigin = origin !== undefined ? origin : current.origin

  const metadata = {
    ...((current.metadata as Record<string, unknown>) || {}),
    ...(body.originCountry !== undefined || body.originRegion !== undefined
      ? {
          originCountry: body.originCountry ?? "",
          originRegion: body.originRegion ?? "",
        }
      : {}),
  }

  const jsonLd = buildProductJsonLd({
    name: nextName,
    story: (nextDesc as string | null) ?? null,
    materials: (current.materials as string | null) ?? null,
    origin: (nextOrigin as string | null) ?? null,
    lifecycle: null,
    imageUrl: (current.image_url as string | null) ?? null,
    brandName: profile?.brand_name ?? null,
  })

  const updatePayload: Record<string, unknown> = {
    name: nextName,
    description: nextDesc,
    category: nextCat,
    origin: nextOrigin,
    json_ld: jsonLd,
    metadata,
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
