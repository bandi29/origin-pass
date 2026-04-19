import { PageHeader } from "@/components/layout/PageHeader"
import { AuthenticityOverviewClient } from "@/components/authenticity/AuthenticityOverviewClient"
import { requireAuth } from "@/lib/require-auth"
import { getAuthenticityOverviewData } from "@/lib/authenticity-server-data"

export default async function DashboardAuthenticityOverviewPage() {
  const { user } = await requireAuth()
  const data = await getAuthenticityOverviewData(user.id)

  return (
    <div className="space-y-8">
      <PageHeader
        title="Authenticity"
        description="Give customers instant proof a product is genuine."
      />
      <AuthenticityOverviewClient
        metrics={data.metrics}
        verificationRows={data.rows}
        scansByProductId={data.scansByProductId}
      />
    </div>
  )
}
