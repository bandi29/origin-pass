import { spacing, typography } from "@/design-system/tokens"
import { MapPin } from "lucide-react"
import { PageHeader } from "@/components/layout/PageHeader"
import { FadeIn } from "@/components/layout/FadeIn"
import { Card } from "@/components/ui/Card"
import { IconChip } from "@/components/ui/IconChip"

export default function AnalyticsLocationsPage() {
  return (
    <FadeIn className={spacing.pageStack}>
      <PageHeader
        title="Geographic insights"
        description="Geographic distribution of scans."
      />

      <Card>
        <div className="flex items-start gap-4">
          <IconChip tone="emerald" size="lg">
            <MapPin />
          </IconChip>
          <div className="min-w-0 flex-1">
            <h2 className={typography.h2}>Locations</h2>
            <p className="mt-1 text-sm leading-relaxed text-ds-text-muted">
              Where your products are being scanned by country and region.
            </p>
          </div>
        </div>
      </Card>
    </FadeIn>
  )
}
