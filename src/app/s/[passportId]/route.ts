import { after } from "next/server"
import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { recordShareClick } from "@/backend/modules/share/repository"
import { isValidUuid } from "@/lib/security"

const CHANNELS = new Set<string>(["whatsapp", "email", "direct"])

function clientIp(request: Request): string | null {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null
}

export async function GET(
  request: Request,
  ctx: { params: Promise<{ passportId: string }> }
) {
  const { passportId: raw } = await ctx.params
  const passportId = raw?.trim() ?? ""

  if (!isValidUuid(passportId)) {
    return NextResponse.redirect(new URL("/?s=invalid", request.url))
  }

  const admin = createAdminClient()
  const { data: passport } = await admin
    .from("passports")
    .select("id, status")
    .eq("id", passportId)
    .maybeSingle()

  if (!passport) {
    return NextResponse.redirect(new URL("/?s=notfound", request.url))
  }

  if (passport.status === "revoked" || passport.status === "expired") {
    return NextResponse.redirect(new URL(`/?s=${passport.status}`, request.url))
  }

  const url = new URL(request.url)
  const sid = url.searchParams.get("sid")
  const ch = url.searchParams.get("ch")

  const dest = new URL(`/p/${passportId}`, request.url)

  if (sid && ch && CHANNELS.has(ch) && isValidUuid(sid)) {
    after(async () => {
      await recordShareClick({
        shareId: sid,
        passportId,
        ip: clientIp(request),
        userAgent: request.headers.get("user-agent"),
      })
    })
  }

  return NextResponse.redirect(dest)
}
