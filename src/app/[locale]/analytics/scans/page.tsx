import { spacing, typography } from "@/design-system/tokens"
import { ScanLine } from "lucide-react"
import { PageHeader } from "@/components/layout/PageHeader"
import { FadeIn } from "@/components/layout/FadeIn"
import { Card } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { IconChip } from "@/components/ui/IconChip"

export default function AnalyticsScansPage() {
  return (
    <FadeIn className={spacing.pageStack}>
      <PageHeader
        title="Scan analytics"
        description="Scan trends, volume, and verification rates."
        actions={
          <Button href="/dashboard/scans" variant="secondary" size="sm">
            Scan history
          </Button>
        }
      />

      <Card>
        <div className="flex items-start gap-4">
          <IconChip tone="indigo" size="lg">
            <ScanLine />
          </IconChip>
          <div className="min-w-0 flex-1">
            <h2 className={typography.h2}>Scans</h2>
            <p className="mt-1 text-sm leading-relaxed text-ds-text-muted">
              View scan history, trends over time, and verification outcomes.
            </p>
          </div>
        </div>
      </Card>
    </FadeIn>
  )
}
