import { PageHeader } from "@/components/layout/PageHeader"
import { InvestigationCenterClient } from "@/components/authenticity/InvestigationCenterClient"
import { requireAuth } from "@/lib/require-auth"
import { createClient } from "@/lib/supabase/server"
import { getUserRole } from "@/lib/rbac"
import {
  getInvestigationSummary,
  listInvestigationAlerts,
  syncCounterfeitAlertsFromScans,
} from "@/lib/counterfeit-alerts-server"

export default async function DashboardVerificationAlertsPage() {
  const { user } = await requireAuth()
  const supabase = await createClient()
  const role = await getUserRole(supabase, user.id)

  await syncCounterfeitAlertsFromScans(user.id)
  const [initialAlerts, initialSummary] = await Promise.all([
    listInvestigationAlerts(user.id, 80, { skipSync: true }),
    getInvestigationSummary(user.id),
  ])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Alerts"
        description="Review suspicious activity, investigate signals, and resolve trust issues."
      />
      <InvestigationCenterClient
        initialAlerts={initialAlerts}
        initialSummary={initialSummary}
        role={role}
      />
    </div>
  )
}
