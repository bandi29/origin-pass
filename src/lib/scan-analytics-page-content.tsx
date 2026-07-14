import { PageHeader } from "@/components/layout/PageHeader"
import { AnalyticsDashboardClient } from "@/components/analytics/AnalyticsDashboardClient"
import {
  getAnalyticsKpis,
  getFraudDistribution,
  getOwnershipOverTime,
  getScansOverTime,
  getTopCountries,
  getTopProducts,
  type AnalyticsFilters,
  type DateRangePreset,
} from "@/backend/modules/analytics/dashboard"
import { requireAuth } from "@/lib/require-auth"

export async function ScanAnalyticsPageContent({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>
}) {
  const { user } = await requireAuth()
  const params = await searchParams
  const range = (params.range as DateRangePreset) ?? "30d"
  const filters: AnalyticsFilters = {
    dateRange: ["7d", "30d", "90d", "custom"].includes(range) ? range : "30d",
  }

  const userId = user.id
  const [
    kpis,
    scansOverTime,
    topCountries,
    fraudDistribution,
    topProducts,
    ownershipOverTime,
  ] = await Promise.all([
    getAnalyticsKpis(userId, filters),
    getScansOverTime(userId, filters),
    getTopCountries(userId, filters),
    getFraudDistribution(userId, filters),
    getTopProducts(userId, filters),
    getOwnershipOverTime(userId, filters),
  ])

  return (
    <div className="space-y-8">
      <PageHeader
        title="Scan analytics"
        description="Scan volume, activity trends, and verification outcomes across your catalog."
      />
      <AnalyticsDashboardClient
        dateRange={filters.dateRange}
        kpis={kpis}
        scansOverTime={scansOverTime}
        topCountries={topCountries}
        fraudDistribution={fraudDistribution}
        topProducts={topProducts}
        ownershipOverTime={ownershipOverTime}
        hideHeader
      />
    </div>
  )
}
