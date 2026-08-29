import QRCode from "qrcode"
import { createClient } from "@/lib/supabase/server"
import {
  loadHangtagPassportSource,
  resolveHangtagScanUrl,
} from "@/lib/hangtag-pdf"

export const runtime = "nodejs"

type RouteContext = {
  params: Promise<{ id: string }>
}

/** ~300 DPI for a 2" QR square. */
const PNG_300DPI_2IN = 600

/**
 * Single QR asset export for hangtags / packaging.
 *
 * Query:
 *   format = png | svg  (default png)
 *   variantGtin = optional GTIN override
 */
export async function GET(request: Request, context: RouteContext) {
  const { id: passportId } = await context.params
  const { searchParams } = new URL(request.url)
  const format = (searchParams.get("format") ?? "png").trim().toLowerCase()
  const variantGtin = searchParams.get("variantGtin")?.trim() || null

  if (format !== "png" && format !== "svg") {
    return Response.json({ error: 'Invalid format. Use "png" or "svg".' }, { status: 400 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const source = await loadHangtagPassportSource(user.id, passportId, { variantGtin })
    if (!source) {
      return Response.json({ error: "Passport not found." }, { status: 404 })
    }

    const { url } = resolveHangtagScanUrl(source)
    const safeSerial =
      source.serialNumber.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 48) || "qr"

    if (format === "svg") {
      const svg = await QRCode.toString(url, {
        type: "svg",
        errorCorrectionLevel: "M",
        margin: 1,
        width: PNG_300DPI_2IN,
        color: { dark: "#111111", light: "#ffffff" },
      })
      return new Response(svg, {
        headers: {
          "Content-Type": "image/svg+xml; charset=utf-8",
          "Content-Disposition": `attachment; filename="passport-${safeSerial}-qr.svg"`,
          "Cache-Control": "private, no-store",
        },
      })
    }

    const png = await QRCode.toBuffer(url, {
      type: "png",
      errorCorrectionLevel: "M",
      margin: 1,
      width: PNG_300DPI_2IN,
      color: { dark: "#111111", light: "#ffffff" },
    })

    return new Response(new Uint8Array(png), {
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": `attachment; filename="passport-${safeSerial}-qr-300dpi.png"`,
        "Cache-Control": "private, no-store",
      },
    })
  } catch (e) {
    console.error("export-qr:", e)
    return Response.json({ error: "Could not generate QR asset." }, { status: 500 })
  }
}
