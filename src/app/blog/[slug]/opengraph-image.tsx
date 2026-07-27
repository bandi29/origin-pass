import { ImageResponse } from "next/og"
import { getPost } from "@/lib/blog"

export const runtime = "nodejs"
export const alt = "OriginPass guide"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

type Props = { params: Promise<{ slug: string }> }

export default async function OpenGraphImage({ params }: Props) {
  const { slug } = await params
  let title = "OriginPass Guide"
  let description = "Digital Product Passport guides for Shopify brands."
  try {
    const post = await getPost(slug)
    title = post.title
    description = post.description
  } catch {
    // keep defaults for unknown slugs
  }

  const shortTitle = title.length > 110 ? `${title.slice(0, 107)}...` : title
  const shortDesc =
    description.length > 160 ? `${description.slice(0, 157)}...` : description

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "linear-gradient(145deg, #0B1F4D 0%, #132a5c 55%, #1a3568 100%)",
          color: "#F8FAFC",
          padding: "56px 64px",
          fontFamily: "Georgia, 'Times New Roman', serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: "#C9A227",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#0B1F4D",
              fontSize: 22,
              fontWeight: 700,
              fontFamily: "system-ui, sans-serif",
            }}
          >
            OP
          </div>
          <div
            style={{
              fontSize: 28,
              fontWeight: 700,
              fontFamily: "system-ui, sans-serif",
              letterSpacing: "-0.02em",
            }}
          >
            OriginPass
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 980 }}>
          <div
            style={{
              fontSize: 18,
              fontWeight: 600,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "#C9A227",
              fontFamily: "system-ui, sans-serif",
            }}
          >
            Digital Product Passport Guide
          </div>
          <div style={{ fontSize: 54, lineHeight: 1.15, fontWeight: 600 }}>{shortTitle}</div>
          <div
            style={{
              fontSize: 26,
              lineHeight: 1.4,
              color: "rgba(248,250,252,0.82)",
              fontFamily: "system-ui, sans-serif",
            }}
          >
            {shortDesc}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontFamily: "system-ui, sans-serif",
            fontSize: 22,
            color: "rgba(248,250,252,0.75)",
          }}
        >
          <div>origin-pass.vercel.app/blog</div>
          <div style={{ color: "#C9A227", fontWeight: 600 }}>Shopify · EU DPP · GS1</div>
        </div>
      </div>
    ),
    { ...size },
  )
}
