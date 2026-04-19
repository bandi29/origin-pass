import { after } from "next/server"
import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { isValidUuid } from "@/lib/security"
import { createScanRedirectToken } from "@/lib/scan-redirect-token"
import { checkScanRouteRateLimit } from "@/lib/scan-route-rate-limit"
import { insertScanEventDeduped } from "@/backend/modules/scan-events/repository"
import { processScan } from "@/backend/modules/scans/process-scan"

function clientIp(request: Request): string | null {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null
}

function scanContext(request: Request) {
  return {
    ipAddress: clientIp(request),
    userAgent: request.headers.get("user-agent"),
    country: request.headers.get("x-vercel-ip-country") || request.headers.get("cf-ipcountry"),
    city: request.headers.get("x-vercel-ip-city"),
  }
}

export async function GET(
  request: Request,
  ctx: { params: Promise<{ passportId: string }> }
) {
  const { passportId } = await ctx.params
  const trimmed = passportId?.trim() ?? ""

  if (!isValidUuid(trimmed)) {
    return NextResponse.redirect(new URL("/?scan=invalid", request.url))
  }

  const ip = clientIp(request)
  if (!checkScanRouteRateLimit(ip).ok) {
    return new NextResponse("Too many requests", { status: 429 })
  }

  const admin = createAdminClient()
  const { data: passport } = await admin
    .from("passports")
    .select("id, status")
    .eq("id", trimmed)
    .maybeSingle()

  if (!passport) {
    return NextResponse.redirect(new URL("/?scan=notfound", request.url))
  }

  if (passport.status === "revoked" || passport.status === "expired") {
    return NextResponse.redirect(new URL(`/?scan=${passport.status}`, request.url))
  }

  const { sk, skt } = createScanRedirectToken(trimmed)
  const base =
    process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/$/, "") || new URL(request.url).origin
  const dest = new URL(`/p/${trimmed}`, base)
  dest.searchParams.set("sk", sk)
  dest.searchParams.set("skt", skt)

  const ctxScan = scanContext(request)

  after(async () => {
    await insertScanEventDeduped({
      passportId: trimmed,
      ip: ctxScan.ipAddress,
      country: ctxScan.country,
      userAgent: ctxScan.userAgent,
    })
    await processScan({
      serialId: trimmed,
      ipAddress: ctxScan.ipAddress,
      userAgent: ctxScan.userAgent,
      city: ctxScan.city,
      country: ctxScan.country,
    })
  })

  return NextResponse.redirect(dest.toString())
}
