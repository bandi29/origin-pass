import { PageHeader } from "@/components/layout/PageHeader"
import { AuthenticityRulesClient } from "@/components/authenticity/AuthenticityRulesClient"

export default function DashboardAuthenticityRulesPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Verification rules"
        description="Configure verification rules and policies."
      />
      <AuthenticityRulesClient />
    </div>
  )
}
