import type { Metadata } from "next"
import { MarketingHome } from "@/components/marketing/MarketingHome"
import { MarketingJsonLd } from "@/components/marketing/MarketingJsonLd"
import { siteUrl } from "@/lib/marketing"

const title = "OriginPass — Digital Product Passports & Traceability"
const description =
  "Create verifiable digital passports for your products. Track origin, ownership, and authenticity with a simple QR scan."

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const base = siteUrl()
  const url = `${base}/${locale}`

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: "OriginPass",
      locale,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  }
}

export default async function Home({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params

  return (
    <>
      <MarketingJsonLd locale={locale} />
      <MarketingHome />
    </>
  )
}
