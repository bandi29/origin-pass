import { after } from "next/server"
import { NextResponse } from "next/server"
import { createHmac } from "node:crypto"
import { createAdminClient } from "@/lib/supabase/admin"
import { isValidUuid } from "@/lib/security"
import { createScanRedirectToken } from "@/lib/scan-redirect-token"
import { checkScanRouteRateLimit } from "@/lib/scan-route-rate-limit"
import { captureScanTelemetryInBackground } from "@/lib/scan-capture-background"
import { extractScanRequestMetadata } from "@/lib/scan-request-metadata"
import {
  logScanTelemetryBypassIfDev,
  shouldBypassScanTelemetry,
} from "@/lib/public-passport-consumer"

function hasValidQrSignature(url: URL, passportId: string): boolean {
  const qt = url.searchParams.get("qt")
  const ts = url.searchParams.get("ts")
  const sig = url.searchParams.get("sig")
  // Backward compatibility for older QR codes without signed query params.
  if (!qt && !ts && !sig) return true
  if (!qt || !ts || !sig) return false
  const secret =
    process.env.QR_SIGNING_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "originpass-dev-signing-key"
  const expected = createHmac("sha256", secret)
    .update(`/scan/${passportId}:${ts}`)
    .digest("hex")
  return sig === expected
}

function buildPublicPassportRedirect(
  passportId: string,
  requestUrl: URL,
): URL {
  const { sk, skt } = createScanRedirectToken(passportId)
  const base =
    process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/$/, "") || requestUrl.origin
  const dest = new URL(`/p/${passportId}`, base)
  dest.searchParams.set("sk", sk)
  dest.searchParams.set("skt", skt)
  if (requestUrl.searchParams.get("preview") === "true") {
    dest.searchParams.set("preview", "true")
  }
  if (requestUrl.searchParams.get("admin") === "true") {
    dest.searchParams.set("admin", "true")
  }
  return dest
}

/**
 * Public QR capture entry: validate → capture request metadata → redirect immediately.
 * Fraud evaluation + passport_scans insert run in after() via the scan pipeline.
 */
export async function GET(
  request: Request,
  ctx: { params: Promise<{ passportId: string }> },
) {
  const { passportId } = await ctx.params
  const trimmed = passportId?.trim() ?? ""
  const requestUrl = new URL(request.url)

  if (!isValidUuid(trimmed)) {
    return NextResponse.redirect(new URL("/?scan=invalid", request.url))
  }
  if (!hasValidQrSignature(requestUrl, trimmed)) {
    return NextResponse.redirect(new URL("/?scan=tampered", request.url))
  }

  const metadata = extractScanRequestMetadata(request)

  if (!checkScanRouteRateLimit(metadata.ipAddress).ok) {
    return new NextResponse("Too many requests", { status: 429 })
  }

  try {
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

    const dest = buildPublicPassportRedirect(trimmed, requestUrl)
    const bypassScanTelemetry = shouldBypassScanTelemetry(requestUrl.searchParams)

    if (!bypassScanTelemetry) {
      after(async () => {
        await captureScanTelemetryInBackground({ passportId: trimmed, metadata })
      })
    } else {
      logScanTelemetryBypassIfDev()
    }

    return NextResponse.redirect(dest.toString())
  } catch (err) {
    console.warn(
      "[scan-capture] passport lookup failed; redirecting without telemetry:",
      err instanceof Error ? err.message : err,
    )
    return NextResponse.redirect(buildPublicPassportRedirect(trimmed, requestUrl).toString())
  }
}
