import { spacing } from "@/design-system/tokens"
import { Link } from "@/i18n/navigation"
import { SiteFooter, SiteHeader } from "@/components/layout/Shell"
import { NarrowContainer } from "@/components/layout/Containers"
import { notFound } from "next/navigation"
import { SimplePageBreadcrumbs } from "@/components/layout/SimplePageBreadcrumbs"
import { PageHeader } from "@/components/layout/PageHeader"
import { FadeIn } from "@/components/layout/FadeIn"

const segments: Record<string, { title: string; body: string }> = {
  "artisan-brands": {
    title: "Artisan Brands",
    body: "Protect handcrafted value with visible authenticity and maker-origin proof.",
  },
  "fashion-brands": {
    title: "Fashion Brands",
    body: "Support product transparency and post-purchase trust at scale.",
  },
  cosmetics: {
    title: "Cosmetics",
    body: "Validate authenticity and ingredient-origin confidence for premium beauty lines.",
  },
  "specialty-foods": {
    title: "Specialty Foods",
    body: "Prove provenance and quality story with scanable records.",
  },
}

export default async function UseCaseSegmentPage({
  params,
}: {
  params: Promise<{ segment: string }>
}) {
  const { segment } = await params
  const page = segments[segment]
  if (!page) notFound()
  const tabs = [
    { href: "/use-cases/artisan-brands", key: "artisan-brands", label: "Artisan Brands" },
    { href: "/use-cases/fashion-brands", key: "fashion-brands", label: "Fashion Brands" },
    { href: "/use-cases/cosmetics", key: "cosmetics", label: "Cosmetics" },
    { href: "/use-cases/specialty-foods", key: "specialty-foods", label: "Specialty Foods" },
  ]

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <SiteHeader />
      <main className={`flex-1 ${spacing.main}`}>
        <NarrowContainer className={`max-w-6xl ${spacing.pageStack}`}>
          <SimplePageBreadcrumbs
            items={[
              { label: "Home", href: "/" },
              { label: "Use cases", href: "/use-cases" },
              { label: page.title },
            ]}
          />
          <FadeIn className={spacing.pageStack}>
            <PageHeader
              title={page.title}
              description={page.body}
              contextBadge="Industry"
            />
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
                Switch industry
              </p>
              <div className="flex flex-wrap gap-2">
                {tabs.map((tab) => (
                  <Link
                    key={tab.key}
                    href={tab.href}
                    className={`rounded-full border px-3 py-1.5 text-sm transition ${
                      tab.key === segment
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {tab.label}
                  </Link>
                ))}
              </div>
            </div>
          </FadeIn>
        </NarrowContainer>
      </main>
      <SiteFooter />
    </div>
  )
}
