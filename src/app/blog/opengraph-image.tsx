import { ImageResponse } from "next/og"

export const runtime = "nodejs"
export const alt = "OriginPass Digital Product Passport Guides"
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

export default function OpenGraphImage() {
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

        <div style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 980 }}>
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
            Guides
          </div>
          <div style={{ fontSize: 60, lineHeight: 1.12, fontWeight: 600 }}>
            Digital Product Passport Guides
          </div>
          <div
            style={{
              fontSize: 28,
              lineHeight: 1.4,
              color: "rgba(248,250,252,0.82)",
              fontFamily: "system-ui, sans-serif",
            }}
          >
            Practical Shopify workflows for EU product data, GS1 QR hangtags, and traceability.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontFamily: "system-ui, sans-serif",
            fontSize: 22,
            color: "rgba(248,250,252,0.75)",
          }}
        >
          <div>origin-pass.vercel.app/blog</div>
          <div style={{ color: "#C9A227", fontWeight: 600 }}>Ready for EU DPP</div>
        </div>
      </div>
    ),
    { ...size },
  )
}
