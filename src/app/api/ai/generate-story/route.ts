import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { getScopedProductIds } from "@/backend/modules/organizations/scope"
import { generateProductStoryWithOpenAI } from "@/lib/ai-story"
import { ensureBrandProfile } from "@/lib/tenancy"

const bodySchema = z.object({
  productId: z.string().uuid(),
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

  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid body" }, { status: 400 })
  }

  const scoped = await getScopedProductIds(user.id)
  if (!scoped.includes(parsed.data.productId)) {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }

  const { data: product, error } = await supabase
    .from("products")
    .select("name, category, origin, description")
    .eq("id", parsed.data.productId)
    .single()

  if (error || !product) {
    return Response.json({ error: "Product not found" }, { status: 404 })
  }

  try {
    const story = await generateProductStoryWithOpenAI({
      name: product.name,
      category: product.category,
      origin: product.origin,
      description: product.description,
    })
    return Response.json({ story })
  } catch (e) {
    console.error("generate-story:", e)
    const msg = e instanceof Error ? e.message : "Generation failed"
    if (msg.includes("OPENAI_API_KEY")) {
      return Response.json({ error: "AI is not configured on this server." }, { status: 503 })
    }
    return Response.json({ error: "Could not generate story. Try again." }, { status: 500 })
  }
}
