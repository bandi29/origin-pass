import { siteUrl } from "@/lib/marketing"

type Props = {
  locale: string
}

export function MarketingJsonLd({ locale }: Props) {
  const base = siteUrl()
  const url = `${base}/${locale}`
  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        name: "OriginPass",
        url,
        description:
          "Digital Product Passport and traceability SaaS — verifiable passports, QR scans, origin and ownership.",
        publisher: { "@id": `${url}#org` },
      },
      {
        "@type": "Organization",
        "@id": `${url}#org`,
        name: "OriginPass",
        url,
        description: "Digital Product Passport and product traceability for authentic brands.",
      },
      {
        "@type": "SoftwareApplication",
        name: "OriginPass",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "USD",
          description: "Free tier available",
        },
      },
    ],
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  )
}
