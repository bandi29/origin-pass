import { PageHeader } from "@/components/layout/PageHeader"
import { AuthenticityAlertsClient } from "@/components/authenticity/AuthenticityAlertsClient"
import { requireAuth } from "@/lib/require-auth"
import { getCounterfeitAlertsForUser } from "@/lib/authenticity-server-data"

export default async function DashboardAuthenticityAlertsPage() {
  const { user } = await requireAuth()
  const initialAlerts = await getCounterfeitAlertsForUser(user.id, 40)

  return (
    <div className="space-y-8">
      <PageHeader
        title="Counterfeit alerts"
        description="Monitor and respond to suspicious activity."
      />
      <AuthenticityAlertsClient initialAlerts={initialAlerts} />
    </div>
  )
}
