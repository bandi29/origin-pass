import { spacing } from "@/design-system/tokens"
import { Link } from "@/i18n/navigation"
import { SiteFooter, SiteHeader } from "@/components/layout/Shell"
import { NarrowContainer } from "@/components/layout/Containers"
import { SimplePageBreadcrumbs } from "@/components/layout/SimplePageBreadcrumbs"
import { PageHeader } from "@/components/layout/PageHeader"
import { FadeIn } from "@/components/layout/FadeIn"
import QRCode from "qrcode"

export default async function PassportOverviewPage({
  params,
}: {
  params: Promise<{ product_id: string; locale: string }>
}) {
  const { product_id, locale } = await params
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
              { label: "Verification", href: `/verify/${product_id}` },
              { label: "Passport" },
            ]}
          />
          <FadeIn className={spacing.pageStack}>
            <PageHeader
              title="Passport"
              description="Authenticity status, product details, and trust summary."
              contextBadge={`ID ${product_id}`}
            />
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full border border-slate-900 bg-slate-900 px-3 py-1.5 text-sm text-white">
                overview
              </span>
              <Link
                href={`/passport/${product_id}/product-origin`}
                className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700"
              >
                product origin
              </Link>
              <Link
                href={`/passport/${product_id}/sustainability`}
                className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700"
              >
                sustainability
              </Link>
              <Link
                href={`/passport/${product_id}/ownership`}
                className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700"
              >
                ownership
              </Link>
            </div>
            <div className="flex flex-col items-center gap-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row">
              <img
                src={qrDataUrl}
                alt={`QR code for passport ${product_id}`}
                className="h-32 w-32 rounded-lg border border-slate-200 bg-white p-1"
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
            <div className="grid gap-3 sm:grid-cols-3">
              <Link
                href="/support"
                className="rounded-xl border border-slate-200 bg-white p-3 text-center text-sm hover:bg-slate-50"
              >
                Register Ownership
              </Link>
              <Link
                href={`/verify/${product_id}`}
                className="rounded-xl border border-slate-200 bg-white p-3 text-center text-sm hover:bg-slate-50"
              >
                Verify Code
              </Link>
              <Link
                href="/support/contact-support"
                className="rounded-xl border border-slate-200 bg-white p-3 text-center text-sm hover:bg-slate-50"
              >
                Report Issue
              </Link>
            </div>
          </FadeIn>
        </NarrowContainer>
      </main>
      <SiteFooter />
    </div>
  )
}
