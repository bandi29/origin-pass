import { spacing } from "@/design-system/tokens"
import { ProductModuleCard } from "@/components/product/ProductModuleCard"
import { operationsModules } from "@/lib/operations-modules"
import { PageHeader } from "@/components/layout/PageHeader"
import { FadeIn } from "@/components/layout/FadeIn"

export default function OperationsHubPage() {
  return (
    <FadeIn className={spacing.pageStack}>
      <PageHeader
        title="Operations"
        description="Manage ownership, compliance, and platform security workflows."
        contextBadge="Dashboard · Operations"
      />

      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
        {operationsModules.map((module) => (
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
