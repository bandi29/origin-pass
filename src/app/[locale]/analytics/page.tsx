import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import {
  getAnalyticsKpis,
  getScansOverTime,
  getTopCountries,
  getFraudDistribution,
  getTopProducts,
  getOwnershipOverTime,
  getFraudAlerts,
  type AnalyticsFilters,
  type DateRangePreset,
} from "@/backend/modules/analytics/dashboard"
import { AnalyticsDashboardClient } from "@/components/analytics/AnalyticsDashboardClient"

type PageProps = {
  searchParams: Promise<{ range?: string }>
}

export default async function AnalyticsPage({ searchParams }: PageProps) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect("/login")

  const params = await searchParams
  const range = (params.range as DateRangePreset) ?? "30d"
  const filters: AnalyticsFilters = {
    dateRange: ["7d", "30d", "90d", "custom"].includes(range) ? range : "30d",
  }

  const userId = user!.id
  const [
    kpis,
    scansOverTime,
    topCountries,
    fraudDistribution,
    topProducts,
    ownershipOverTime,
    fraudAlerts,
  ] = await Promise.all([
    getAnalyticsKpis(userId, filters),
    getScansOverTime(userId, filters),
    getTopCountries(userId, filters),
    getFraudDistribution(userId, filters),
    getTopProducts(userId, filters),
    getOwnershipOverTime(userId, filters),
    getFraudAlerts(userId, filters),
  ])

  return (
    <AnalyticsDashboardClient
      dateRange={filters.dateRange}
      kpis={kpis}
      scansOverTime={scansOverTime}
      topCountries={topCountries}
      fraudDistribution={fraudDistribution}
      topProducts={topProducts}
      ownershipOverTime={ownershipOverTime}
      fraudAlerts={fraudAlerts}
    />
  )
}
