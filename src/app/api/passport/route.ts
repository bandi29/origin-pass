import { passportUpsertBodySchema } from "@/lib/passport-wizard-schemas"
import { createPassportAction } from "@/actions/create-passport"
import { createAdminClient } from "@/lib/supabase/admin"
import { getScopedProductIds } from "@/backend/modules/organizations/scope"
import { createClient } from "@/lib/supabase/server"
import { ensureBrandProfile } from "@/lib/tenancy"

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

  const parsed = passportUpsertBodySchema.safeParse(json)
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Invalid body"
    return Response.json({ error: msg }, { status: 400 })
  }

  const { productId, story, materials, timeline } = parsed.data

  const scoped = await getScopedProductIds(user.id)
  if (!scoped.includes(productId)) {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }

  const admin = createAdminClient()
  const { data: existingPassport } = await admin
    .from("passports")
    .select("id, metadata")
    .eq("product_id", productId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle()

  let passportId = existingPassport?.id as string | undefined

  if (!passportId) {
    const created = await createPassportAction({ productId, batchSize: 1 })
    if (!created.success || !created.passport) {
      return Response.json(
        { error: created.error ?? "Could not create passport." },
        { status: 400 }
      )
    }
    passportId = created.passport.id
  }

  const prevMeta =
    (existingPassport?.metadata as Record<string, unknown> | null | undefined) || {}
  const nextMeta = {
    ...prevMeta,
    wizard: {
      story: story ?? "",
      materials: materials ?? [],
      timeline: timeline ?? [],
    },
  }

  const { error: upErr } = await admin.from("passports").update({ metadata: nextMeta }).eq("id", passportId)

  if (upErr) {
    console.error("passport metadata update:", upErr)
    return Response.json({ error: "Could not save passport." }, { status: 500 })
  }

  return Response.json({ passportId })
}
