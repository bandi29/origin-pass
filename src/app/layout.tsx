import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { headers } from "next/headers"
import "./globals.css"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
  adjustFontFallback: true,
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
  adjustFontFallback: true,
})

const SHOPIFY_API_KEY = process.env.NEXT_PUBLIC_SHOPIFY_API_KEY ?? ""

export const metadata: Metadata = {
  title: "OriginPass — Digital Product Passports",
  description:
    "Verify scans, protect your craft, and give customers confidence — passports, ownership, and analytics in one workspace.",
  icons: {
    icon: [
      { url: "/favicon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/brand/originpass-icon.png", sizes: "1024x1024", type: "image/png" },
    ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    title: "OriginPass — Digital Product Passports",
    description:
      "Verify scans, protect your craft, and give customers confidence — passports, ownership, and analytics in one workspace.",
    images: [{ url: "/brand/originpass-icon.png", width: 1024, height: 1024, alt: "OriginPass" }],
  },
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const shopifyEmbedded = (await headers()).get("x-shopify-embedded") === "1"
  const loadAppBridge = (await headers()).get("x-shopify-app-bridge") === "1"

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {shopifyEmbedded && loadAppBridge && SHOPIFY_API_KEY ? (
          <>
            <meta name="shopify-api-key" content={SHOPIFY_API_KEY} />
            {/* App Bridge must not use next/script — async ordering aborts init. */}
            <script src="https://cdn.shopify.com/shopifycloud/app-bridge.js" />
          </>
        ) : null}
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-primary`}
      >
        {children}
      </body>
    </html>
  )
}
