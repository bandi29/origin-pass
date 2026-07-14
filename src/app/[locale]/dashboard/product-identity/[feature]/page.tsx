import { spacing } from "@/design-system/tokens"
import { notFound } from "next/navigation"
import { getProductModuleBySlug } from "@/lib/product-modules"
import { PageHeader } from "@/components/layout/PageHeader"
import { FadeIn } from "@/components/layout/FadeIn"

const featureContent: Record<
  string,
  { summary: string; points: string[] }
> = {
  passports: {
    summary:
      "Publish verifiable product data for authenticity, origin, and compliance readiness.",
    points: [
      "Structured product identity",
      "EU DPP-ready field model",
      "Public trust page per product",
    ],
  },
  authenticity: {
    summary:
      "Let customers verify products instantly with a scan-first trust experience.",
    points: [
      "Verified badge and status",
      "Revoked/invalid handling",
      "Support actions for issues",
    ],
  },
  "qr-identity": {
    summary:
      "Generate QR identities per product or batch with secure, trackable tokens.",
    points: [
      "Unique passport token",
      "Print-ready labels",
      "Scan event logging",
    ],
  },
  ownership: {
    summary:
      "Support registration, warranty activation, and long-term product lifecycle trust.",
    points: [
      "Ownership registration",
      "Warranty actions",
      "Lifecycle and care communication",
    ],
  },
}

export default async function ProductIdentityFeaturePage({
  params,
}: {
  params: Promise<{ feature: string }>
}) {
  const { feature } = await params
  const module = getProductModuleBySlug(feature)
  const content = featureContent[feature]

  if (!module || !content) notFound()

  return (
    <FadeIn className={spacing.pageStack}>
      <PageHeader title={module.title} description={content.summary} />
      <ul className="space-y-2">
        {content.points.map((point) => (
          <li
            key={point}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-700 shadow-sm"
          >
            {point}
          </li>
        ))}
      </ul>
    </FadeIn>
  )
}
