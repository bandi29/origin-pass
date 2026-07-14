import { spacing, typography } from "@/design-system/tokens"
import {
  VERIFICATION_ROUTES,
  VERIFICATION_SUITE_NAV_VISIBLE,
} from "@/lib/verification-nav"
import { QR_IDENTITY_PATHS } from "@/lib/qr-identity-nav"
import { ShieldAlert } from "lucide-react"
import { PageHeader } from "@/components/layout/PageHeader"
import { FadeIn } from "@/components/layout/FadeIn"
import { Card } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { IconChip } from "@/components/ui/IconChip"

export default function AnalyticsFraudPage() {
  return (
    <FadeIn className={spacing.pageStack}>
      <PageHeader
        title="Fraud detection"
        description="Suspicious activity and counterfeit alerts."
        actions={
          VERIFICATION_SUITE_NAV_VISIBLE ? (
            <Button href={VERIFICATION_ROUTES.overview} variant="secondary" size="sm">
              Verifications
            </Button>
          ) : (
            <Button href={QR_IDENTITY_PATHS.verification} variant="secondary" size="sm">
              Security verification
            </Button>
          )
        }
      />

      <Card>
        <div className="flex items-start gap-4">
          <IconChip tone="rose" size="lg">
            <ShieldAlert />
          </IconChip>
          <div className="min-w-0 flex-1">
            <h2 className={typography.h2}>Fraud</h2>
            <p className="mt-1 text-sm leading-relaxed text-ds-text-muted">
              Monitor duplicate scans, geographic anomalies, and flagged passports.
            </p>
          </div>
        </div>
      </Card>
    </FadeIn>
  )
}
