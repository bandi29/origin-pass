import { z } from "zod"
import { createAdminClient } from "@/lib/supabase/admin"
import { createShareEvent, type ShareChannel } from "@/backend/modules/share/repository"
import { checkShareCreateRateLimit } from "@/lib/share-create-rate-limit"
import { isValidUuid } from "@/lib/security"

const bodySchema = z.object({
  passportId: z.string().uuid(),
  channel: z.enum(["whatsapp", "email", "direct"]),
})

function clientIp(request: Request): string | null {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null
}

function baseUrl(request: Request): string {
  return (
    process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/$/, "") ||
    new URL(request.url).origin
  )
}

export async function POST(request: Request) {
  if (!checkShareCreateRateLimit(clientIp(request)).ok) {
    return Response.json({ error: "Too many share links. Try again later." }, { status: 429 })
  }

  let json: unknown
  try {
    json = await request.json()
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid body" }, { status: 400 })
  }

  const { passportId, channel } = parsed.data
  if (!isValidUuid(passportId)) {
    return Response.json({ error: "Invalid passport" }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: passport, error: pErr } = await admin
    .from("passports")
    .select("id, status")
    .eq("id", passportId)
    .maybeSingle()

  if (pErr || !passport) {
    return Response.json({ error: "Passport not found" }, { status: 404 })
  }

  if (passport.status === "revoked" || passport.status === "expired") {
    return Response.json({ error: "Passport not available" }, { status: 400 })
  }

  const created = await createShareEvent(passportId, channel as ShareChannel)
  if (!created) {
    return Response.json({ error: "Could not create share link" }, { status: 500 })
  }

  const origin = baseUrl(request)
  const url = `${origin}/s/${passportId}?sid=${created.id}&ch=${channel}`

  return Response.json({ shareId: created.id, url })
}
