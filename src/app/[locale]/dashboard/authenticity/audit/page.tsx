import { PageHeader } from "@/components/layout/PageHeader"
import { AuthenticityAuditLogsClient } from "@/components/authenticity/AuthenticityAuditLogsClient"
import { requireAuth } from "@/lib/require-auth"
import { getAuditLogForUser } from "@/lib/authenticity-server-data"

export default async function DashboardAuthenticityAuditPage() {
  const { user } = await requireAuth()
  const initialRows = await getAuditLogForUser(user.id, 200)

  return (
    <div className="space-y-8">
      <PageHeader
        title="Compliance & audit"
        description="DPP-ready event history with export for audits and regulators."
      />
      <AuthenticityAuditLogsClient initialRows={initialRows} />
    </div>
  )
}
