import { spacing } from "@/design-system/tokens"
import { ProductModuleCard } from "@/components/product/ProductModuleCard"
import { analyticsModules } from "@/lib/analytics-modules"
import { PageHeader } from "@/components/layout/PageHeader"
import { FadeIn } from "@/components/layout/FadeIn"

export default function AnalyticsHubPage() {
  return (
    <FadeIn className={spacing.pageStack}>
      <PageHeader
        title="Analytics"
        description="Brand intelligence from scan behavior, verification risk, and geographic activity."
        contextBadge="Dashboard · Analytics"
      />

      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
        {analyticsModules.map((module) => (
          <ProductModuleCard
            key={module.id}
            href={module.href}
            icon={module.icon}
            title={module.title}
            description={module.description}
          />
        ))}
      </div>
    </FadeIn>
  )
}
