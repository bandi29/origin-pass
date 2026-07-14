import { AuthenticityRulesClient } from "@/components/authenticity/AuthenticityRulesClient"

export default function DashboardVerificationRulesPage() {
  return (
    <div className="space-y-8">
      <AuthenticityRulesClient />
    </div>
  )
}
