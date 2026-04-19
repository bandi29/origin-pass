import { spacing } from "@/design-system/tokens"
import { SiteFooter, SiteHeader } from "@/components/layout/Shell"
import { NarrowContainer } from "@/components/layout/Containers"
import { notFound } from "next/navigation"
import { SimplePageBreadcrumbs } from "@/components/layout/SimplePageBreadcrumbs"
import { PageHeader } from "@/components/layout/PageHeader"
import { FadeIn } from "@/components/layout/FadeIn"

const topics: Record<string, { title: string; body: string }> = {
  "eu-digital-product-passport": {
    title: "EU Digital Product Passport",
    body: "Prepare with product fields for origin, materials, lifecycle, and transparent verification records.",
  },
  "sustainability-transparency": {
    title: "Sustainability Transparency",
    body: "Show what products are made of, where they come from, and how they are designed to last.",
  },
  "supply-chain-traceability": {
    title: "Supply Chain Traceability",
    body: "Give customers and partners scanable provenance checkpoints without heavy enterprise infrastructure.",
  },
}

export default async function ComplianceTopicPage({
  params,
}: {
  params: Promise<{ topic: string }>
}) {
  const { topic } = await params
  const page = topics[topic]
  if (!page) notFound()

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <SiteHeader />
      <main className={`flex-1 ${spacing.main}`}>
        <NarrowContainer className={`max-w-6xl ${spacing.pageStack}`}>
          <SimplePageBreadcrumbs
            items={[
              { label: "Home", href: "/" },
              { label: "Compliance", href: "/compliance" },
              { label: page.title },
            ]}
          />
          <FadeIn className="space-y-4">
            <PageHeader title={page.title} description={page.body} />
          </FadeIn>
        </NarrowContainer>
      </main>
      <SiteFooter />
    </div>
  )
}
