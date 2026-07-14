import { LABEL_TEMPLATE_LOGO_MAX_BYTES } from "@/lib/labels/layout-template-types"

const MAX_LOGO_EDGE_PX = 256

/** Downscale and compress a logo data URL for inline template storage. */
export async function prepareLogoForTemplateSnapshot(
  dataUrl: string | null,
): Promise<string | null> {
  if (!dataUrl?.startsWith("data:image/")) return null

  if (typeof document === "undefined") {
    if (byteLengthOfDataUrl(dataUrl) <= LABEL_TEMPLATE_LOGO_MAX_BYTES) return dataUrl
    return null
  }

  try {
    const img = await loadImage(dataUrl)
    const scale = Math.min(1, MAX_LOGO_EDGE_PX / Math.max(img.width, img.height, 1))
    const w = Math.max(1, Math.round(img.width * scale))
    const h = Math.max(1, Math.round(img.height * scale))
    const canvas = document.createElement("canvas")
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext("2d")
    if (!ctx) return null
    ctx.drawImage(img, 0, 0, w, h)

    for (const quality of [0.82, 0.65, 0.5, 0.35]) {
      const out = canvas.toDataURL("image/jpeg", quality)
      if (byteLengthOfDataUrl(out) <= LABEL_TEMPLATE_LOGO_MAX_BYTES) return out
    }
    return null
  } catch {
    return null
  }
}

export function byteLengthOfDataUrl(dataUrl: string): number {
  const comma = dataUrl.indexOf(",")
  if (comma < 0) return dataUrl.length
  const base64 = dataUrl.slice(comma + 1)
  return Math.ceil((base64.length * 3) / 4)
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error("Failed to load logo image"))
    img.src = src
  })
}
