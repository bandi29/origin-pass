import { spacing } from "@/design-system/tokens"
import { ProductModuleCard } from "@/components/product/ProductModuleCard"
import { systemModules } from "@/lib/system-modules"
import { PageHeader } from "@/components/layout/PageHeader"
import { FadeIn } from "@/components/layout/FadeIn"

export default function SystemHubPage() {
  return (
    <FadeIn className={spacing.pageStack}>
      <PageHeader
        title="System"
        description="Manage your team, integrations, and workspace configuration."
        contextBadge="Dashboard · System"
      />

      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
        {systemModules.map((module) => (
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
