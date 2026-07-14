import { spacing, typography } from "@/design-system/tokens"
import { Shield } from "lucide-react"
import { PageHeader } from "@/components/layout/PageHeader"
import { FadeIn } from "@/components/layout/FadeIn"
import { Card } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { IconChip } from "@/components/ui/IconChip"

export default function SettingsSecurityPage() {
  return (
    <FadeIn className={spacing.pageStack}>
      <PageHeader
        title="Security"
        description="Security and authentication settings."
        actions={
          <Button href="/dashboard/settings/security" variant="secondary" size="sm">
            Security settings
          </Button>
        }
      />

      <Card>
        <div className="flex items-start gap-4">
          <IconChip tone="navy" size="lg">
            <Shield />
          </IconChip>
          <div className="min-w-0 flex-1">
            <h2 className={typography.h2}>Security</h2>
            <p className="mt-1 text-sm leading-relaxed text-ds-text-muted">
              Password, two-factor authentication, and session management.
            </p>
          </div>
        </div>
      </Card>
    </FadeIn>
  )
}
