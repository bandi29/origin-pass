import { NextResponse, type NextRequest } from "next/server"
import { checkRateLimitAsync } from "@/lib/rate-limit"
import { DPP_CHECKLIST_TAG } from "@/lib/dpp-checklist-content"
import { subscribeLeadMagnet } from "@/lib/email-provider"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** Best-effort client key for rate limiting (Vercel sets x-forwarded-for). */
function clientKey(request: NextRequest): string {
  const fwd = request.headers.get("x-forwarded-for") ?? ""
  return fwd.split(",")[0]?.trim() || "unknown"
}

/**
 * POST /api/lead-magnet/subscribe — register a checklist subscriber.
 *
 * Public + unauthenticated by design (it is a lead magnet), so it is rate
 * limited. We store nothing ourselves: the email provider owns the subscriber,
 * the PDF delivery, and the nurture sequence.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const rate = await checkRateLimitAsync(`lead-magnet:${clientKey(request)}`, 5, 10 * 60 * 1000)
  if (!rate.ok) {
    return NextResponse.json(
      { ok: false, status: "error", message: "Too many attempts — please try again shortly." },
      { status: 429 },
    )
  }

  let body: { email?: unknown; consent?: unknown }
  try {
    body = (await request.json()) as { email?: unknown; consent?: unknown }
  } catch {
    return NextResponse.json({ ok: false, status: "invalid", message: "Malformed request." }, { status: 400 })
  }

  const email = typeof body.email === "string" ? body.email.trim() : ""
  const consent = body.consent === true

  // Consent is a hard gate: never register a subscriber without it.
  if (!consent) {
    return NextResponse.json(
      { ok: false, status: "invalid", message: "Please tick the consent box so we can email you the checklist." },
      { status: 400 },
    )
  }

  const outcome = await subscribeLeadMagnet({ email, consent, source: DPP_CHECKLIST_TAG })

  switch (outcome.status) {
    case "subscribed":
      return NextResponse.json({
        ok: true,
        status: "subscribed",
        message: "Check your inbox — the checklist is on its way.",
      })
    case "duplicate":
      return NextResponse.json({
        ok: true,
        status: "duplicate",
        message: "You're already on the list — we've re-sent the checklist to that address.",
      })
    case "invalid":
      return NextResponse.json({ ok: false, status: "invalid", message: outcome.message }, { status: 400 })
    default:
      return NextResponse.json({ ok: false, status: "error", message: outcome.message }, { status: 502 })
  }
}
