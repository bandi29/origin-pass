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
