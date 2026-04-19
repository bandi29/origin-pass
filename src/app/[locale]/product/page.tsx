import { spacing } from "@/design-system/tokens"
import { SiteFooter, SiteHeader } from "@/components/layout/Shell"
import { NarrowContainer } from "@/components/layout/Containers"
import { ProductModuleCard } from "@/components/product/ProductModuleCard"
import { productModules } from "@/lib/product-modules"
import { ProductAreaBreadcrumbs } from "@/components/layout/ProductAreaBreadcrumbs"
import { FadeIn } from "@/components/layout/FadeIn"

export default function ProductPage() {
  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <SiteHeader />
      <main className={`flex-1 ${spacing.main}`}>
        <NarrowContainer className={`max-w-6xl ${spacing.pageStack}`}>
          <ProductAreaBreadcrumbs />
          <FadeIn className={spacing.pageStack}>
          <header className="space-y-3">
            <h1 className="text-4xl font-bold tracking-tight text-slate-900 md:text-5xl">
              Product
            </h1>
            <p className="text-lg text-slate-600">
              Explore the core modules powering OriginPass.
            </p>
          </header>

          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
            {productModules.map((module) => (
              <ProductModuleCard
                key={module.id}
                href={`/product/${module.slug}`}
                icon={module.icon}
                title={module.title}
                description={module.description}
              />
            ))}
          </div>
          </FadeIn>
        </NarrowContainer>
      </main>
      <SiteFooter />
    </div>
  )
}
