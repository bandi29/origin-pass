import { PageHeader } from "@/components/layout/PageHeader"
import { FraudAnalyticsDashboardClient } from "@/components/authenticity/FraudAnalyticsDashboardClient"
import { requireAuth } from "@/lib/require-auth"
import { getFraudAnalyticsData } from "@/lib/authenticity-server-data"

export async function FraudAnalyticsPageContent() {
  const { user } = await requireAuth()
  const data = await getFraudAnalyticsData(user.id)

  return (
    <div className="space-y-8">
      <PageHeader
        title="Fraud analytics"
        description="Trends, affected SKUs, and alert mix for your verification program."
      />
      <FraudAnalyticsDashboardClient data={data} />
    </div>
  )
}
