import { spacing } from "@/design-system/tokens"
import { ProductModuleCard } from "@/components/product/ProductModuleCard"
import { productModules } from "@/lib/product-modules"
import { PageHeader } from "@/components/layout/PageHeader"
import { FadeIn } from "@/components/layout/FadeIn"
import { PRODUCT_IDENTITY_MODULE_HUB_PATH } from "@/lib/product-identity-nav"

export default function ProductIdentityHubPage() {
  return (
    <FadeIn className={spacing.pageStack}>
      <PageHeader
        title="Product Identity"
        description="Explore the core modules powering OriginPass."
        contextBadge="Dashboard · Product Identity"
      />

      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        {productModules.map((module) => (
          <ProductModuleCard
            key={module.id}
            href={`${PRODUCT_IDENTITY_MODULE_HUB_PATH}/${module.slug}`}
            icon={module.icon}
            title={module.title}
            description={module.description}
            iconTheme={module.iconTheme}
          />
        ))}
      </div>
    </FadeIn>
  )
}
