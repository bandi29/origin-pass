import type { Metadata } from "next"
import { SiteHeader, SiteFooter } from "@/components/layout/Shell"
import { PricingPlans } from "@/components/marketing/PricingPlans"
import { MarketingJsonLd } from "@/components/marketing/MarketingJsonLd"
import { PageContainer } from "@/components/ui/PageContainer"
import { SectionHeader } from "@/components/ui/SectionHeader"
import { siteUrl } from "@/lib/marketing"

const title = "Pricing — OriginPass"
const description =
  "Free, Pro, and Business plans for digital product passports. Start free, scale with analytics and team features."

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const base = siteUrl()
  const url = `${base}/${locale}/pricing`

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
    twitter: { card: "summary_large_image", title, description },
  }
}

export default async function PricingPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params

  return (
    <>
      <MarketingJsonLd locale={locale} />
      <div className="flex min-h-screen flex-col bg-background">
        <SiteHeader />

        <main className="flex-1">
          <PageContainer className="py-24 md:py-28">
            <SectionHeader
              as="h1"
              title="Pricing"
              description={
                <>
                  <p>
                    Start free with core passports and QR. Upgrade for analytics, AI stories,
                    languages, and team features.
                  </p>
                  <p className="text-sm text-muted">
                    No credit card required to start · Setup in under 2 minutes · Cancel anytime on
                    paid plans
                  </p>
                </>
              }
            />

            <PricingPlans />
          </PageContainer>
        </main>

        <SiteFooter />
      </div>
    </>
  )
}
