import { NextResponse, type NextRequest } from "next/server"
import { buildGs1JsonLd } from "@/lib/gs1-passport-resolve"
import {
  classifyGs1DigitalLinkRequest,
  GS1_INVALID_STRUCTURE_MESSAGE,
  GS1_NOT_FOUND_MESSAGE,
  invalidStructureHtml,
  notFoundPassportHtml,
  publicPassportTargetPath,
  wantsGs1MachinePayload,
} from "@/lib/gs1-http"
import {
  relativeRedirectLocation,
  resolvePublicRequestHref,
} from "@/lib/public-request-origin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type RouteContext = {
  params: Promise<{ gs1Path: string[] }>
}

/**
 * GS1 Digital Link entry: `/01/{gtin}`[+`/10/{lot}`][+`/21/{serial}`]
 *
 * Content negotiation (GS1-03):
 * - Accept: application/ld+json | application/json -> GS1 JSON-LD
 * - Browser / text/html -> 307 to existing public passport HTML (`/sp` or `/p`)
 *
 * Errors: 400 malformed structure (GS1-04); 404 unassigned GTIN (GS1-05). Never 500.
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { gs1Path } = await context.params
    const segments = Array.isArray(gs1Path) ? gs1Path : []
    const classification = await classifyGs1DigitalLinkRequest(segments)
    const accept = request.headers.get("accept")
    const machine = wantsGs1MachinePayload(accept)
    // Prefer forwarded tunnel/prod host - shopify:dev proxies to localhost:3000.
    const requestUrl = resolvePublicRequestHref(request)

    if (classification.kind === "invalid_structure") {
      if (machine) {
        return NextResponse.json(
          {
            error: GS1_INVALID_STRUCTURE_MESSAGE,
            "@context": "https://gs1.org/voc/",
          },
          {
            status: 400,
            headers: { "Content-Type": "application/ld+json; charset=utf-8" },
          },
        )
      }
      return new NextResponse(invalidStructureHtml(), {
        status: 400,
        headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
      })
    }

    if (classification.kind === "not_found") {
      if (machine) {
        return NextResponse.json(
          {
            error: GS1_NOT_FOUND_MESSAGE,
            "@context": "https://gs1.org/voc/",
          },
          {
            status: 404,
            headers: { "Content-Type": "application/ld+json; charset=utf-8" },
          },
        )
      }
      return new NextResponse(notFoundPassportHtml(), {
        status: 404,
        headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
      })
    }

    const { product } = classification

    if (machine) {
      return NextResponse.json(buildGs1JsonLd(product, requestUrl), {
        status: 200,
        headers: {
          "Content-Type": "application/ld+json; charset=utf-8",
          "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=600",
        },
      })
    }

    const targetPath = publicPassportTargetPath(product)
    if (!targetPath) {
      return new NextResponse(notFoundPassportHtml(), {
        status: 404,
        headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
      })
    }

    // targetPath may already include ?variant= from publicPassportTargetPath.
    // Dummy base only for URL/searchParams. Location must be host-relative so
    // Cloudflare tunnel traffic is not bounced to https://localhost:3000/...
    const target = new URL(targetPath, "http://originpass.local")
    if (product.lot) target.searchParams.set("lot", product.lot)
    if (product.serial) target.searchParams.set("serial", product.serial)
    if (product.externalVariantId && !target.searchParams.has("variant")) {
      target.searchParams.set("variant", product.externalVariantId)
    }

    const location = relativeRedirectLocation(`${target.pathname}${target.search}`)

    // GS1-03: browser follows 307 to the styled public passport landing page.
    // Use a relative Location (not NextResponse.redirect absolute URL) so the
    // browser stays on the public host (tunnel / Vercel / localhost).
    return new NextResponse(null, {
      status: 307,
      headers: { Location: location },
    })
  } catch {
    return new NextResponse(notFoundPassportHtml(), {
      status: 404,
      headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
    })
  }
}
