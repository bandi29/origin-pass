import { spacing, typography } from "@/design-system/tokens"
import { Package } from "lucide-react"
import { PageHeader } from "@/components/layout/PageHeader"
import { FadeIn } from "@/components/layout/FadeIn"
import { Card } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { IconChip } from "@/components/ui/IconChip"

export default function AnalyticsProductsPage() {
  return (
    <FadeIn className={spacing.pageStack}>
      <PageHeader
        title="Product analytics"
        description="Performance metrics by product."
        actions={
          <Button href="/dashboard/products" variant="secondary" size="sm">
            View products
          </Button>
        }
      />

      <Card>
        <div className="flex items-start gap-4">
          <IconChip tone="violet" size="lg">
            <Package />
          </IconChip>
          <div className="min-w-0 flex-1">
            <h2 className={typography.h2}>Products</h2>
            <p className="mt-1 text-sm leading-relaxed text-ds-text-muted">
              Scan volume, verification rates, and engagement by product.
            </p>
          </div>
        </div>
      </Card>
    </FadeIn>
  )
}
