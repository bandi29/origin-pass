import { spacing, typography } from "@/design-system/tokens"
import { User } from "lucide-react"
import { PageHeader } from "@/components/layout/PageHeader"
import { FadeIn } from "@/components/layout/FadeIn"
import { Card } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"
import { IconChip } from "@/components/ui/IconChip"

export default function SettingsAccountPage() {
  return (
    <FadeIn className={spacing.pageStack}>
      <PageHeader
        title="Account"
        description="Profile and account preferences."
        actions={
          <Button href="/dashboard/settings/profile" variant="secondary" size="sm">
            Profile settings
          </Button>
        }
      />

      <Card>
        <div className="flex items-start gap-4">
          <IconChip tone="indigo" size="lg">
            <User />
          </IconChip>
          <div className="min-w-0 flex-1">
            <h2 className={typography.h2}>Account</h2>
            <p className="mt-1 text-sm leading-relaxed text-ds-text-muted">
              Update your profile, email, and preferences.
            </p>
          </div>
        </div>
      </Card>
    </FadeIn>
  )
}
