import { spacing, typography } from "@/design-system/tokens"
import { CreditCard } from "lucide-react"
import { PageHeader } from "@/components/layout/PageHeader"
import { FadeIn } from "@/components/layout/FadeIn"
import { Card } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { IconChip } from "@/components/ui/IconChip"

export default function SettingsBillingPage() {
  return (
    <FadeIn className={spacing.pageStack}>
      <PageHeader
        title="Billing"
        description="Subscription and billing management."
        actions={
          <Button href="/dashboard/billing" variant="secondary" size="sm">
            Open billing
          </Button>
        }
      />

      <Card>
        <div className="flex items-start gap-4">
          <IconChip tone="emerald" size="lg">
            <CreditCard />
          </IconChip>
          <div className="min-w-0 flex-1">
            <h2 className={typography.h2}>Billing</h2>
            <p className="mt-1 text-sm leading-relaxed text-ds-text-muted">
              Manage your subscription, payment methods, and invoices.
            </p>
          </div>
        </div>
      </Card>
    </FadeIn>
  )
}
