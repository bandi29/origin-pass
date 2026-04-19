import { spacing } from "@/design-system/tokens"
import { Link } from "@/i18n/navigation"
import { SiteFooter, SiteHeader } from "@/components/layout/Shell"
import { NarrowContainer } from "@/components/layout/Containers"
import { notFound } from "next/navigation"
import { SimplePageBreadcrumbs } from "@/components/layout/SimplePageBreadcrumbs"
import { PageHeader } from "@/components/layout/PageHeader"
import { FadeIn } from "@/components/layout/FadeIn"
import QRCode from "qrcode"

const tabs: Record<string, string> = {
  "product-origin": "Manufacturing region, artisan context, and production timeline.",
  sustainability: "Materials, lifecycle, and transparency disclosures.",
  ownership: "Warranty and ownership registration details.",
}

function prettySection(slug: string) {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")
}

export default async function PassportConsumerSectionPage({
  params,
}: {
  params: Promise<{ product_id: string; section: string[]; locale: string }>
}) {
  const { product_id, section, locale } = await params
  const current = section[0]
  if (!tabs[current]) notFound()
  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL ||
    (typeof process.env.VERCEL_URL === "string"
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000")
  const verifyUrl = `${baseUrl}/${locale}/verify/${product_id}`
  const qrDataUrl = await QRCode.toDataURL(verifyUrl, { width: 180, margin: 1 })

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <SiteHeader />
      <main className={`flex-1 ${spacing.main}`}>
        <NarrowContainer className={`max-w-6xl ${spacing.pageStack}`}>
          <SimplePageBreadcrumbs
            items={[
              { label: "Home", href: "/" },
              { label: "Passport", href: `/passport/${product_id}` },
              { label: prettySection(current) },
            ]}
          />
          <FadeIn className={spacing.pageStack}>
            <PageHeader title={prettySection(current)} description={tabs[current]} />
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/passport/${product_id}`}
                className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700"
              >
                overview
              </Link>
              {Object.keys(tabs).map((key) => (
                <Link
                  key={key}
                  href={`/passport/${product_id}/${key}`}
                  className={`rounded-full border px-3 py-1.5 text-sm ${
                    current === key
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-white text-slate-700"
                  }`}
                >
                  {key.replace(/-/g, " ")}
                </Link>
              ))}
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-sm text-slate-600">{tabs[current]}</p>
            </div>
            <div className="flex flex-col items-center gap-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row">
              <img
                src={qrDataUrl}
                alt={`QR code for passport ${product_id}`}
                className="h-28 w-28 rounded-lg border border-slate-200 bg-white p-1"
              />
              <div className="text-sm text-slate-600">
                <p className="font-medium text-slate-900">Passport QR Code</p>
                <p className="mt-1">Scan to open verification for this passport.</p>
                <a
                  href={verifyUrl}
                  className="mt-3 inline-flex rounded-lg border border-slate-200 px-3 py-1.5 text-slate-700 hover:bg-slate-50"
                >
                  Open verification URL
                </a>
              </div>
            </div>
          </FadeIn>
        </NarrowContainer>
      </main>
      <SiteFooter />
    </div>
  )
}
