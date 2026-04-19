import { spacing } from "@/design-system/tokens"
import { SiteFooter, SiteHeader } from "@/components/layout/Shell"
import { NarrowContainer } from "@/components/layout/Containers"
import { notFound } from "next/navigation"
import { SimplePageBreadcrumbs } from "@/components/layout/SimplePageBreadcrumbs"
import { PageHeader } from "@/components/layout/PageHeader"
import { FadeIn } from "@/components/layout/FadeIn"

const docs: Record<string, { title: string; points: string[] }> = {
  "getting-started": {
    title: "Getting Started",
    points: [
      "Create organization",
      "Add first product",
      "Generate first passport",
      "Publish QR verification",
    ],
  },
  "api-documentation": {
    title: "API Documentation",
    points: [
      "Authentication model",
      "Product and passport endpoints",
      "Scan and ownership events",
      "Versioning and limits",
    ],
  },
  "integration-guides": {
    title: "Integration Guides",
    points: [
      "Shopify sync setup",
      "WooCommerce setup",
      "CSV import workflow",
      "Webhook event handling",
    ],
  },
}

export default async function DocumentationTopicPage({
  params,
}: {
  params: Promise<{ topic: string }>
}) {
  const { topic } = await params
  const page = docs[topic]
  if (!page) notFound()

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <SiteHeader />
      <main className={`flex-1 ${spacing.main}`}>
        <NarrowContainer className={`max-w-6xl ${spacing.pageStack}`}>
          <SimplePageBreadcrumbs
            items={[
              { label: "Home", href: "/" },
              { label: "Documentation", href: "/documentation" },
              { label: page.title },
            ]}
          />
          <FadeIn className={spacing.pageStack}>
            <PageHeader title={page.title} description="Guides and reference for OriginPass." />
            <ul className="space-y-2 text-slate-700">
              {page.points.map((point) => (
                <li
                  key={point}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
                >
                  {point}
                </li>
              ))}
            </ul>
          </FadeIn>
        </NarrowContainer>
      </main>
      <SiteFooter />
    </div>
  )
}
